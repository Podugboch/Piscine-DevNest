// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import axios from "axios";

// export default function Login() {
//   const navigate = useNavigate();
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState("");

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");

//     try {
//       const res = await axios.post("http://localhost:8080/api/login", { email, password });
//       localStorage.setItem("token", res.data.token);

//       localStorage.setItem("token", res.data.token);
//       navigate("/dashboard");
//     } catch (err) {
//       setError(err.response?.data?.error || "Login failed");
//     }
//   };

//   return (
//     <div className="login-page">
//       <h2>Login</h2>
//       <form onSubmit={handleSubmit}>
//         <label>Email:</label>
//         <input
//           type="email"
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           required
//         />

//         <label>Password:</label>
//         <input
//           type="password"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//         />

//         {error && <p style={{ color: "red" }}>{error}</p>}

//         <button type="submit">Login</button>
//       </form>
//     </div>
//   );
// }
