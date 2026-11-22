import { z } from "zod";

export const signupSchema = z.object({
  name: z.string({ message: "Name is required." }).trim().min(1, "Name is required."),
  email: z
    .string({ message: "Enter a valid email address." })
    .trim()
    .toLowerCase()
    .email("Enter a valid email address."),
  password: z
    .string({ message: "Password must be at least 8 characters." })
    .min(8, "Password must be at least 8 characters."),
});

export const loginSchema = z.object({
  email: z.string({ message: "Email and password are required." }).trim().toLowerCase(),
  password: z.string({ message: "Email and password are required." }),
});
