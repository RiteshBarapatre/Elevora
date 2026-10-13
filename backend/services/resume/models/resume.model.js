import mongoose from "mongoose";

const educationSchema = new mongoose.Schema(
  {
    degree: {
      type: String,
      default: "",
    },
    institution: {
      type: String,
      default: "",
    },
    startDate: {
      type: String,
      default: "",
    },
    endDate: {
      type: String,
      default: "",
    },
    gpa: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const experienceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "",
    },
    company: {
      type: String,
      default: "",
    },
    startDate: {
      type: String,
      default: "",
    },
    endDate: {
      type: String,
      default: "",
    },
    responsibilities: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },

    extractedText: {
      type: String,
      required: true,
    },

    score: {
      type: Number,
      default: 0,
    },

    summary: {
      type: String,
      default: "",
    },

    name: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    education: {
      type: [educationSchema],
      default: [],
    },

    skills: {
      type: [String],
      default: [],
    },

    projects: {
      type: [String],
      default: [],
    },

    experience: {
      type: [experienceSchema],
      default: [],
    },

    strengths: {
      type: [String],
      default: [],
    },

    weaknesses: {
      type: [String],
      default: [],
    },

    missingSkills: {
      type: [String],
      default: [],
    },

    suggestedRole: {
      type: String,
      default: "",
    },

    recommendations: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const Resume = mongoose.model("Resume", resumeSchema);

export default Resume;