"use client";

import { useState } from "react";

import { LoginOne } from "@/components/ui/login-1";

export default function Demo() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <LoginOne
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={(event) => event.preventDefault()}
      onTogglePassword={() => setShowPassword((current) => !current)}
      showPassword={showPassword}
      statusMessage="Demo mode keeps the backend disconnected. Use this component from /login or /access for the real flow."
    />
  );
}
