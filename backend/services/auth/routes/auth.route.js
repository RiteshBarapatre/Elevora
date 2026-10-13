import express from "express";
import {
  addCoins,
  forgotPassword,
  login,
  loginWithEmail,
  logout,
  resetPassword,
  sendOtp,
  signup,
  useInterviewCoins,
  verifyOtp,
} from "../controllers/auth.controller.js";

const authRouter = express.Router();

authRouter.post("/login", login);
authRouter.post("/login-email", loginWithEmail);
authRouter.post("/signup", signup);
authRouter.post("/send-otp", sendOtp);
authRouter.post("/verify-otp", verifyOtp);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);
authRouter.get("/logout", logout);
authRouter.post("/add-coins", addCoins);
authRouter.post("/use-coins", useInterviewCoins);

export default authRouter;