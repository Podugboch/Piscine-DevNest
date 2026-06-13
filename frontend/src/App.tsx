import { useState, useEffect } from "react";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );

  const [user, setUser] = useState<any>(null);
  const [page, setPage] = useState("dashboard");

  // -----------------------------
  // MOCK COMMUNITY POSTS (LIVE HUB CORE)
  // -----------------------------
  const [posts, setPosts] = useState([
    {
      id: 1,
      user: "Jay",
      content: "Finally fixed my Go JWT middleware bug 🚀",
    },
    {
      id: 2,
      user: "Ayo",
      content: "Why is Vercel ignoring my latest deployment?",
    },
    {
      id: 3,
      user: "Mina",
      content: "React useEffect timing still confuses me 😭",
    },
  ]);

  const [newPost, setNewPost] = useState("");

  // -----------------------------
  // FETCH USER (/api/me)
  // -----------------------------
  const fetchMe = async (jwt: string) => {
    try {
      const res = await fetch("http://localhost:8080/api/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      if (!res.ok) {
        return null;
      }

      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  // -----------------------------
  // LOAD USER ON TOKEN CHANGE
  // -----------------------------
  useEffect(() => {
    if (!token) return;

    const loadUser = async () => {
      const data = await fetchMe(token);

      if (data) {
        setUser(data);
      } else {
        localStorage.removeItem("token");
        setToken(null);
      }
    };

    loadUser();
  }, [token]);

  // -----------------------------
  // LOGIN
  // -----------------------------
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
      setToken(data.token);

      alert("Login successful!");
    } catch (err) {
      console.error(err);
      alert("Could not connect to server");
    }
  };

  // -----------------------------
  // LOGGED-IN VIEW (LIVE COMMUNITY HUB)
  // -----------------------------
  if (token) {
    return (
      <div style={{ display: "flex", height: "100vh" }}>

        {/* SIDEBAR */}
        <div
          style={{
            width: "220px",
            background: "#111",
            color: "white",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <h2>DevNest</h2>

          <button onClick={() => setPage("dashboard")}>Feed</button>
          <button onClick={() => setPage("create")}>Create Post</button>
          <button onClick={() => setPage("profile")}>Profile</button>

          <hr />

          <button
            onClick={() => {
              localStorage.removeItem("token");
              setToken(null);
              setUser(null);
            }}
          >
            Logout
          </button>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, padding: 30 }}>

          {/* FEED */}
          {page === "dashboard" && (
            <>
              <h1>Live Feed 🚀</h1>
              <p>What’s happening in DevNest</p>

              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 15 }}>
                {posts.map((post) => (
                  <div
                    key={post.id}
                    style={{
                      padding: 15,
                      border: "1px solid #ddd",
                      borderRadius: 8,
                    }}
                  >
                    <b>{post.user}</b>
                    <p>{post.content}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* CREATE POST */}
          {page === "create" && (
            <>
              <h1>Create Post</h1>

              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Share a win, question, or discovery..."
                style={{ width: "100%", height: 120 }}
              />

              <br />

              <button
                onClick={() => {
                  if (!newPost.trim()) return;

                  const post = {
                    id: Date.now(),
                    user: user?.email || "Anonymous",
                    content: newPost,
                  };

                  setPosts([post, ...posts]);
                  setNewPost("");
                  setPage("dashboard");
                }}
              >
                Post
              </button>
            </>
          )}

          {/* PROFILE */}
          {page === "profile" && (
            <>
              <h1>Profile</h1>

              {user ? (
                <>
                  <p>Email: {user.email}</p>
                  <p>Name: {user.name}</p>
                </>
              ) : (
                <p>Loading...</p>
              )}
            </>
          )}

        </div>
      </div>
    );
  }

  // -----------------------------
  // LOGIN SCREEN
  // -----------------------------
  return (
    <div style={{ padding: 40 }}>
      <h1>DevNest Login</h1>

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