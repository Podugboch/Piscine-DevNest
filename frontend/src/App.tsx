import { useState, useEffect } from "react";

type User = {
  id: number;
  username: string;
  email: string;
};

type Post = {
  id: number;
  content: string;
  createdAt?: string;
  user?: User; // Handles backend relations cleanly
};

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );

  // Default to a fallback local dev user if backend profile isn't ready
  const [user, setUser] = useState<User | null>({
    id: 1,
    username: "Jaytricks",
  email: "jay@example.com"
  });
  
  const [page, setPage] = useState<"feed" | "create" | "profile">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");

  // -----------------------------
  // FETCH USER PROFILE
  // -----------------------------
  const fetchMe = async (jwt: string) => {
    try {
      const res = await fetch("http://localhost:8080/api/me", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!token) return;

    (async () => {
      const data = await fetchMe(token);
      if (data) {
        setUser(data);
      } else {
        console.warn("⚠️ /api/me endpoint failed or unconfigured. Staying logged in with local fallback profile.");
      }
    })();
  }, [token]);

  // -----------------------------
  // FETCH POSTS FEED (Live Backend Connection)
  // -----------------------------
  const fetchPosts = async () => {
    try {
      const res = await fetch("http://localhost:8080/api/posts", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

if (res.ok) {
  const data = await res.json();
  setPosts(data || []);
}
    } catch (err) {
      console.error("Could not fetch live feed, using mock data placeholders instead.", err);
      // Mock data placeholder fallback if backend feed isn't running yet
      setPosts([
        { id: 1, content: "Finally fixed my Go JWT middleware bug 🚀", user: { id: 99, username: "Jay", email: "" } },
        { id: 2, content: "Why is Vercel ignoring my latest deployment?", user: { id: 98, username: "Ayo", email: "" } }
      ]);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPosts();
    }
  }, [token, page]); // Refetches when switching pages/views

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
      
      if (data.token) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
      } else {
        alert("Backend authentication success, but no token key was found in response.");
      }
    } catch {
      alert("Cannot connect to server at http://localhost:8080");
    }
  };

  // -----------------------------
  // POST CREATION
  // -----------------------------
  const createPost = async () => {
    if (!newPost.trim()) return;

    try {
      const res = await fetch("http://localhost:8080/api/posts", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ content: newPost }),
      });

      if (res.ok) {
        setNewPost("");
        setPage("feed"); // Redirecting back updates feed automatically via useEffect
      } else {
        alert("Failed to save post to backend.");
      }
    } catch {
      // Local UI fallback block if API server drops offline
      const fallbackPost: Post = {
        id: Date.now(),
        content: newPost,
        user: user || { id: 1, username: "Anonymous", email: "" }
      };
      setPosts([fallbackPost, ...posts]);
      setNewPost("");
      setPage("feed");
    }
  };

  // -----------------------------
  // LOGGED OUT VIEW
  // -----------------------------
  if (!token) {
    return (
      <div style={styles.authPage}>
        <div style={styles.authCard}>
          <h1 style={{ marginBottom: 10 }}>DevNest</h1>
          <p style={{ opacity: 0.7, marginBottom: 20 }}>
            A live community for Piscine builders
          </p>

          <input
            style={styles.input}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button style={styles.primaryBtn} onClick={login}>
            Login
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------
  // LOGGED IN LAYOUT
  // -----------------------------
  return (
    <div style={styles.app}>
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <h2 style={{ marginBottom: 20 }}>DevNest</h2>

        <button
          style={page === "feed" ? styles.activeNav : styles.navBtn}
          onClick={() => setPage("feed")}
        >
          Feed
        </button>

        <button
          style={page === "create" ? styles.activeNav : styles.navBtn}
          onClick={() => setPage("create")}
        >
          Create Post
        </button>

        <button
          style={page === "profile" ? styles.activeNav : styles.navBtn}
          onClick={() => setPage("profile")}
        >
          Profile
        </button>

        <div style={{ marginTop: "auto" }}>
          <button
            style={styles.logoutBtn}
            onClick={() => {
              localStorage.removeItem("token");
              setToken(null);
              setUser(null);
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={styles.main}>
        {/* FEED */}
        {page === "feed" && (
          <>
            <h1 style={{ marginBottom: 5 }}>Live Feed</h1>
            <p style={{ opacity: 0.6, marginBottom: 20 }}>
              What’s happening in DevNest
            </p>

            <div style={styles.feed}>
              {posts.map((post) => {
                const displayName = post.user?.username || "Anonymous";
                return (
                  <div key={post.id} style={styles.postCard}>
                    <div style={styles.postHeader}>
                      <div style={styles.avatar}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <b>{displayName}</b>
                        <div style={styles.timestamp}>
                          {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : "Just now"}
                        </div>
                      </div>
                    </div>

                    <p style={styles.postContent}>{post.content}</p>
                  </div>
                );
              })}
              {posts.length === 0 && <p style={{ opacity: 0.5 }}>No posts found on the feed.</p>}
            </div>
          </>
        )}

        {/* CREATE */}
        {page === "create" && (
          <div style={styles.createBox}>
            <h1>Create Post</h1>

            <textarea
              style={styles.textarea}
              placeholder="Share a win, bug, idea, or question..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
            />

            <button style={styles.primaryBtn} onClick={createPost}>
              Publish
            </button>
          </div>
        )}

        {/* PROFILE */}
        {page === "profile" && (
          <div>
            <h1>Profile</h1>

            {user ? (
              <div style={styles.profileCard}>
                <p><b>Email:</b> {user.email}</p>
                <p><b>Username:</b> {user.username || "N/A"}</p>
              </div>
            ) : (
              <p>Loading...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------
// STYLES (Kept exactly as you had them)
// -----------------------------
const styles: any = {
  app: { display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", background: "#0b0f19", color: "#fff" },
  sidebar: { width: 240, background: "#111827", padding: 20, display: "flex", flexDirection: "column", borderRight: "1px solid #1f2937" },
  navBtn: { background: "transparent", border: "none", color: "#aaa", padding: "10px 0", textAlign: "left", cursor: "pointer" },
  activeNav: { background: "#1f2937", border: "none", color: "#fff", padding: "10px", textAlign: "left", borderRadius: 6, cursor: "pointer" },
  logoutBtn: { marginTop: 20, background: "#ef4444", border: "none", color: "#fff", padding: 10, width: "100%", borderRadius: 6, cursor: "pointer" },
  main: { flex: 1, padding: 30, overflowY: "auto" },
  feed: { display: "flex", flexDirection: "column", gap: 15, maxWidth: 600 },
  postCard: { background: "#111827", padding: 15, borderRadius: 10, border: "1px solid #1f2937" },
  postHeader: { display: "flex", gap: 10, alignItems: "center", marginBottom: 10 },
  avatar: { width: 35, height: 35, borderRadius: "50%", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" },
  postContent: { fontSize: 14, lineHeight: 1.5 },
  timestamp: { fontSize: 12, opacity: 0.5 },
  createBox: { maxWidth: 600 },
  textarea: { width: "100%", height: 120, marginTop: 10, marginBottom: 10, padding: 10, borderRadius: 8, border: "1px solid #374151", background: "#111827", color: "#fff" },
  input: { display: "block", width: "100%", padding: 10, marginBottom: 10, borderRadius: 6, border: "1px solid #333", background: "#0f172a", color: "#fff", boxSizing: "border-box" },
  primaryBtn: { background: "#2563eb", color: "#fff", border: "none", padding: "10px 15px", borderRadius: 6, cursor: "pointer" },
  authPage: { display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#0b0f19" },
  authCard: { width: 320, padding: 20, borderRadius: 10, background: "#111827", border: "1px solid #1f2937" },
  profileCard: { background: "#111827", padding: 15, borderRadius: 10, maxWidth: 400 },
};