"use client";

import { ReactNode } from "react";
import AuthProviderWrapper from "./AuthProviderWrapper";

interface WithAuthProviderProps {
  children: ReactNode;
}

export default function WithAuthProvider({ children }: WithAuthProviderProps) {
  return <AuthProviderWrapper>{children}</AuthProviderWrapper>;
}