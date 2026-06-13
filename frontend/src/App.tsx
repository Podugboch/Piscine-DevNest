import { useState } from "react";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
  try {
    const res = await fetch("http://localhost:8080/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      alert("Invalid email or password");
      return;
    }

    const data = await res.json();

    localStorage.setItem("token", data.token);

    alert("Login successful!");

    console.log(data);
  } catch (err) {
    console.error(err);
    alert("Could not connect to server");
  }
};

  return (
    <div style={{ padding: 40 }}>
      <h1>Piscine DevNest</h1>

      <input
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br />

      <input
        placeholder="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br />

      <button onClick={login}>Login</button>
    </div>
  );
}
