import jwt from "jsonwebtoken";
import { prisma } from "../index.js";

export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required. Please provide a valid token.",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        isApproved: true,
        isActive: true, // ✅ ADD THIS
        fullName: true,
        phoneNumber: true,
      },
    });
  
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "User not found",
      });
    }

    // ✅ ADD THIS - Check if user is blocked
    if (!user.isActive) {
      return res.status(403).json({
        status: "error",
        message: "Your account has been blocked. Please contact support.",
      });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
      isActive: user.isActive,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
    };
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "error",
        message: "Invalid token",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Token expired",
      });
    }
    next(error);
  }
};

/**
 * Middleware to authorize user based on roles
 * @param  {...string} roles - Allowed roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message:
          "Access denied. You do not have permission to perform this action.",
      });
    }

    next();
  };
};
