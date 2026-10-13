import crypto from "crypto";
import nodemailer from "nodemailer";
import { getAuth } from "firebase-admin/auth";

import { app } from "../configs/firebase.js";
import User from "../model/user.model.js";
import redis from "../../../shared/redis/redis.js";

const OTP_TTL_SECONDS = 300;

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

const createHash = (password, salt) =>
  crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");

const createSalt = () => crypto.randomBytes(16).toString("hex");

const createSessionPayload = (user) => ({
  userId: user._id.toString(),
  name: user.name,
  email: user.email,
  interviewCoin: user.interviewCoin,
  authProvider: user.firebaseUid?.startsWith("google-") ? "google" : "email",
});

const saveSession = async (res, user) => {
  const sessionId = crypto.randomUUID();

  await redis.set(
    `session:${sessionId}`,
    JSON.stringify(createSessionPayload(user)),
    "EX",
    60 * 60 * 24 * 7
  );

  res.cookie("session", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });

  return sessionId;
};

const sendOtpMail = async (email, otp, subject = "Verify your Elevora account", message = "Your Elevora verification code is") => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log(`OTP for ${email}: ${otp}`);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || "Elevora <no-reply@elevora.com>",
      to: email,
      subject,
      text: `${message} ${otp}. It expires in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #111827;">
          <h2 style="margin-bottom: 12px;">Elevora</h2>
          <p>${message}:</p>
          <h3 style="letter-spacing: 4px; font-size: 28px; margin: 18px 0;">${otp}</h3>
          <p>This code expires in 5 minutes.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error("SMTP send failed. Falling back to console OTP:", error.message);
    console.log(`OTP for ${email}: ${otp}`);
    return false;
  }
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  interviewCoin: user.interviewCoin,
  authProvider: user.firebaseUid?.startsWith("google-") ? "google" : "email",
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const sendOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const userExists = await User.findOne({ email });

    if (req.body.mode === "signup" && userExists) {
      return res.status(409).json({ success: false, message: "Account already exists. Please log in instead." });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    await redis.set(
      `otp:${email}`,
      JSON.stringify({ otp, email, createdAt: Date.now() }),
      "EX",
      OTP_TTL_SECONDS
    );

    await sendOtpMail(email, otp);

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email for verification.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const storedOtp = await redis.get(`otp:${email}`);

    if (!storedOtp) {
      return res.status(400).json({ success: false, message: "OTP expired or not found." });
    }

    const parsedOtp = JSON.parse(storedOtp);

    if (String(parsedOtp.otp) !== String(otp)) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    await redis.set(`otp:verified:${email}`, "true", "EX", 600);

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const signup = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const otp = String(req.body.otp || "");

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const storedOtp = await redis.get(`otp:${email}`);

    if (!storedOtp) {
      return res.status(400).json({ success: false, message: "Please send a valid OTP first." });
    }

    const parsedOtp = JSON.parse(storedOtp);

    if (String(parsedOtp.otp) !== String(otp)) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ success: false, message: "User already exists. Please login." });
    }

    const salt = createSalt();
    const passwordHash = createHash(password, salt);

    const user = await User.create({
      name,
      email,
      passwordHash,
      passwordSalt: salt,
      firebaseUid: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      interviewCoin: 150,
    });

    await redis.del(`otp:${email}`);
    await redis.del(`otp:verified:${email}`);

    await saveSession(res, user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const loginWithEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    if (!user || !user.passwordHash || !user.passwordSalt) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const computedHash = createHash(password, user.passwordSalt);

    if (computedHash !== user.passwordHash) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    await saveSession(res, user);

    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const decoded = await getAuth(app).verifyIdToken(token);

    let user = await User.findOne({ firebaseUid: decoded.uid });

    if (!user) {
      user = await User.create({
        firebaseUid: `google-${decoded.uid}`,
        email: decoded.email,
        name: decoded.name || decoded.email?.split("@")[0] || "User",
        interviewCoin: 150,
      });
    }

    await saveSession(res, user);

    return res.json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const sessionId = req.cookies?.session;

    if (sessionId) {
      await redis.del(`session:${sessionId}`);
    }

    res.clearCookie("session", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const useInterviewCoins = async (req, res) => {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      return res.status(401).json({ success: false, message: "Session expired" });
    }

    const session = await redis.get(`session:${sessionId}`);

    if (!session) {
      return res.status(401).json({ success: false, message: "Session expired" });
    }

    const sessionData = JSON.parse(session);
    const { coins } = req.body;

    if (!coins) {
      return res.status(400).json({
        success: false,
        message: "Coins are required",
      });
    }

    const user = await User.findById(sessionData.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.interviewCoin < coins) {
      return res.status(403).json({
        success: false,
        message: "Not enough interview coins",
        interviewCoin: user.interviewCoin,
      });
    }

    user.interviewCoin -= coins;

    await user.save();

    await redis.set(
      `session:${sessionId}`,
      JSON.stringify({
        userId: user._id,
        name: user.name,
        email: user.email,
        interviewCoin: user.interviewCoin,
      }),
      "EX",
      60 * 60 * 24 * 7
    );

    return res.status(200).json({
      success: true,
      message: "Interview coins updated successfully",
      interviewCoin: user.interviewCoin,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const addCoins = async (req, res) => {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: "Session expired",
      });
    }

    const session = await redis.get(`session:${sessionId}`);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Session expired",
      });
    }

    const sessionData = JSON.parse(session);
    const { coins } = req.body;

    if (!coins || coins <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid coins are required",
      });
    }

    const user = await User.findById(sessionData.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.interviewCoin += Number(coins);
    await user.save();

    await redis.set(
      `session:${sessionId}`,
      JSON.stringify({
        userId: user._id,
        name: user.name,
        email: user.email,
        interviewCoin: user.interviewCoin,
      }),
      "EX",
      60 * 60 * 24 * 7
    );

    return res.status(200).json({
      success: true,
      message: "Coins added successfully",
      interviewCoin: user.interviewCoin,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    await redis.set(
      `password-reset-otp:${email}`,
      JSON.stringify({ otp, email, createdAt: Date.now() }),
      "EX",
      OTP_TTL_SECONDS
    );

    await sendOtpMail(email, otp, "Elevora Password Reset", "Your Elevora password reset code is");

    return res.status(200).json({
      success: true,
      message: "Password reset OTP sent to your email.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with this email." });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    await redis.set(
      `reset:otp:${email}`,
      JSON.stringify({ otp, email, createdAt: Date.now() }),
      "EX",
      OTP_TTL_SECONDS
    );

    await sendOtpMail(
      email,
      otp,
      "Reset your Elevora password",
      "Your password reset code is"
    );

    return res.status(200).json({
      success: true,
      message: "Password reset code sent to your email.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ success: false, message: "Email, OTP and new password are required" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const storedOtp = await redis.get(`reset:otp:${email}`);

    if (!storedOtp) {
      return res.status(400).json({ success: false, message: "Password reset code expired or invalid." });
    }

    const parsedOtp = JSON.parse(storedOtp);

    if (String(parsedOtp.otp) !== String(otp)) {
      return res.status(400).json({ success: false, message: "Invalid reset code." });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const salt = createSalt();
    const passwordHash = createHash(password, salt);

    user.passwordHash = passwordHash;
    user.passwordSalt = salt;
    await user.save();

    await redis.del(`reset:otp:${email}`);

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};