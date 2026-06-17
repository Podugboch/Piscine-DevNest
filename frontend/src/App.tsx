import { useState, useEffect } from "react";
import { timeAgo } from "./utils/timeAgo";

type User = {
  id: number;
  username: string;
  email: string;
  bio?: string;
  skills?: string;
  location?: string;
  avatar_url?: string;
};

type Comment = {
  id: number;
  post_id: number;
  content: string;
  created_at: string;
  user?: User;
};

type Post = {
  id: number;
  content: string;
  media_url?: string;
  created_at?: string;
  user?: User;
  likes: number;
  comments?: Comment[];
};

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // New States for Multi-Auth Handling
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");

  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );

  const [user, setUser] = useState<User | null>({
    id: 1,
    username: "Jaytricks",
    email: "jay@example.com",
  });

  const [page, setPage] = useState<"feed" | "create" | "profile">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const [pageNumber, setPageNumber] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [commentInputs, setCommentInputs] = useState<{ [postId: number]: string }>({});
  const [expandedComments, setExpandedComments] = useState<{ [postId: number]: boolean }>({});

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editText, setEditText] = useState("");

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: "",
    bio: "",
    skills: "",
    location: "",
  });

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
        console.warn("⚠️ /api/me failed. Using fallback profile.");
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchPosts(1);
  }, [token]);

  // -----------------------------
  // FETCH POSTS
  // -----------------------------
  const fetchPosts = async (pageNum: number = 1) => {
    try {
      const res = await fetch(
        `http://localhost:8080/api/posts?page=${pageNum}&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();

        const dedupe = (arr: Post[]) => {
          const seen = new Set<number>();
          return arr.filter((p) => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
        };

        if (pageNum === 1) {
          setPosts(dedupe(data || []));
        } else {
          setPosts((prev) => dedupe([...prev, ...(data || [])]));
        }

        if ((data || []).length < 10) setHasMore(false);
      }
    } catch (err) {
      console.error("Could not fetch live feed.", err);
      setPosts([
        { id: 1, content: "Finally fixed my Go JWT middleware bug 🚀", likes: 0, user: { id: 99, username: "Jay", email: "" } },
        { id: 2, content: "Why is Vercel ignoring my latest deployment?", likes: 0, user: { id: 98, username: "Ayo", email: "" } },
      ]);
    }
  };

  const loadMorePosts = async () => {
    setLoadingMore(true);
    const nextPage = pageNumber + 1;
    await fetchPosts(nextPage);
    setPageNumber(nextPage);
    setLoadingMore(false);
  };

  useEffect(() => {
    const closeAllDropdowns = () => setActiveDropdown(null);
    window.addEventListener("click", closeAllDropdowns);
    return () => window.removeEventListener("click", closeAllDropdowns);
  }, []);

  // -----------------------------
  // DELETE POST
  // -----------------------------
  const deletePost = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8080/api/posts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert("Failed to delete post");
      }
    } catch (err) {
      console.error(err);
    }
  };

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

      if (!res.ok) { alert("Invalid email or password"); return; }

      const data = await res.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
      } else {
        alert("No token found in response.");
      }
    } catch {
      alert("Cannot connect to server at http://localhost:8080");
    }
  };

  // -----------------------------
  // CREATE POST
  // -----------------------------
  const createPost = async () => {
    if (!newPost.trim() && !selectedFile) return;
    setUploadingMedia(true);

    try {
      let uploadedUrl = "";

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await fetch("http://localhost:8080/api/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadRes.ok) {
          alert("Failed to upload media file.");
          setUploadingMedia(false);
          return;
        }

        const uploadData = await uploadRes.json();
        uploadedUrl = uploadData.url;
      }

      const res = await fetch("http://localhost:8080/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newPost, media_url: uploadedUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        const newPostObj: Post = {
          ...data,
          likes: 0,
          comments: [],
          user: data.user && data.user.username ? data.user : user || { id: 0, username: "Anonymous", email: "" },
        };
        setPosts((prev) => [newPostObj, ...prev]);
        setNewPost("");
        setSelectedFile(null);
        setMediaPreview(null);
        setPage("feed");
      } else {
        alert("Failed to save post to backend.");
      }
    } catch (err) {
      console.error(err);
      alert("Connection error during publishing.");
    } finally {
      setUploadingMedia(false);
    }
  };

  // -----------------------------
  // LOGGED OUT VIEW (AUTH GATE)
  // -----------------------------
  if (!token) {
    const handleRegister = async () => {
      if (!email || !username || !password) {
        alert("Please fill out all fields.");
        return;
      }
      try {
        const res = await fetch("http://localhost:8080/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username, password }),
        });

        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Registration failed");
          return;
        }

        alert("Account created successfully! You can now log in.");
        setAuthMode("login"); 
      } catch {
        alert("Cannot connect to server at http://localhost:8080");
      }
    };

    return (
      <div style={styles.authPage}>
        <div style={styles.authCard}>
          <h1 style={{ marginBottom: 5 }}>DevNest</h1>
          <p style={{ opacity: 0.7, marginBottom: 20 }}>
            {authMode === "login" ? "A live community for Piscine builders" : "Create a new developer profile"}
          </p>

          {authMode === "register" && (
            <input 
              style={styles.input} 
              placeholder="Username" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
            />
          )}

          <input style={styles.input} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={styles.input} placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          
          {authMode === "login" ? (
            <>
              <button style={styles.primaryBtn} onClick={login}>Login</button>
              <p style={{ fontSize: 12, marginTop: 15, textAlign: "center", opacity: 0.6 }}>
                New to DevNest?{" "}
                <span style={{ color: "#2563eb", cursor: "pointer", textDecoration: "underline" }} onClick={() => setAuthMode("register")}>
                  Sign up
                </span>
              </p>
            </>
          ) : (
            <>
              <button style={styles.primaryBtn} onClick={handleRegister}>Create Account</button>
              <p style={{ fontSize: 12, marginTop: 15, textAlign: "center", opacity: 0.6 }}>
                Already registered?{" "}
                <span style={{ color: "#2563eb", cursor: "pointer", textDecoration: "underline" }} onClick={() => setAuthMode("login")}>
                  Log in
                </span>
              </p>
            </>
          )}
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
        <button style={page === "feed" ? styles.activeNav : styles.navBtn} onClick={() => setPage("feed")}>Feed</button>
        <button style={page === "create" ? styles.activeNav : styles.navBtn} onClick={() => setPage("create")}>Create Post</button>
        <button style={page === "profile" ? styles.activeNav : styles.navBtn} onClick={() => setPage("profile")}>Profile</button>
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
            <p style={{ opacity: 0.6, marginBottom: 20 }}>What's happening in DevNest</p>

            <div style={styles.feed}>
              {posts.map((post) => {
                const displayName = post.user?.username || "Anonymous";
                const postComments = post.comments || [];
                const isDropdownOpen = activeDropdown === post.id;
                const isCommentsExpanded = expandedComments[post.id] || false;

                return (
                  <div key={post.id} style={styles.postCard}>
                    
                    {/* POST HEADER WITH DROPDOWN MENU */}
                    <div style={styles.postHeader}>
                      <div style={styles.avatar}>
                        {post.user?.avatar_url ? (
                          <img src={post.user.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <b>{displayName}</b>
                        <div style={styles.timestamp}>
                          {post.created_at ? timeAgo(post.created_at) : "Just now"}
                        </div>
                      </div>

                      <div style={{ marginLeft: "auto", position: "relative" }}>
                        <button 
                          style={styles.iconBtn} 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdown(isDropdownOpen ? null : post.id);
                          }}
                        >
                          ⋮
                        </button>

                        {isDropdownOpen && (
                          <div style={styles.dropdownMenu}>
                            <button 
                              style={styles.dropdownItem} 
                              onClick={() => { setEditingPost(post); setEditText(post.content); setActiveDropdown(null); }}
                            >
                              ✏️ Edit Post
                            </button>
                            <button 
                              style={{ ...styles.dropdownItem, color: "#ef4444" }} 
                              onClick={() => { deletePost(post.id); setActiveDropdown(null); }}
                            >
                              🗑️ Delete Post
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CONTENT */}
                    <p style={styles.postContent}>{post.content}</p>

                    {/* MEDIA */}
                    {post.media_url && (
                      <div style={{ marginTop: 10, borderRadius: 8, overflow: "hidden", background: "#000" }}>
                        {post.media_url.match(/\.(mp4|webm|ogg|mov|MOV|mp4\?|mov\?)/i) || post.media_url.includes("video") ? (
                          <video src={post.media_url} controls style={{ width: "100%", maxHeight: 500 }} />
                        ) : (
                          <img src={post.media_url} alt="Post asset" style={{ width: "100%", maxHeight: 400, objectFit: "contain" }} />
                        )}
                      </div>
                    )}

                    {/* INTERACTION ACTION BAR */}
                    <div style={styles.actionBar}>
                      <button 
                        style={styles.actionBtn} 
                        onClick={async () => {
                          try {
                            const res = await fetch(`http://localhost:8080/api/posts/${post.id}/like`, {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            if (res.ok) {
                              setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: p.likes + 1 } : p));
                            }
                          } catch (err) { console.error("Like error", err); }
                        }}
                      >
                        ❤️ {post.likes || 0} Likes
                      </button>

                      <button 
                        style={styles.actionBtn}
                        onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !isCommentsExpanded }))}
                      >
                        💬 {postComments.length} Comments
                      </button>

                      <button 
                        style={styles.actionBtn}
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`);
                          alert("Post link copied to clipboard! Share it with fellow builders.");
                        }}
                      >
                        🔗 Share
                      </button>
                    </div>

                    {/* EDIT INLINE DROP PANEL */}
                    {editingPost?.id === post.id && (
                      <div style={{ background: "#0b0f19", padding: 15, borderRadius: 10, marginTop: 10, border: "1px solid #374151" }}>
                        <h3>Edit Post</h3>
                        <textarea style={styles.textarea} value={editText} onChange={(e) => setEditText(e.target.value)} />
                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            style={styles.primaryBtn}
                            onClick={async () => {
                              try {
                                const res = await fetch(`http://localhost:8080/api/posts/${editingPost?.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ content: editText }),
                                });
                                if (!res.ok) return;
                                const updatedPost = await res.json();
                                setPosts((prev) => prev.map((p) => p.id === updatedPost.id ? { ...p, content: updatedPost.content } : p));
                                setEditingPost(null);
                              } catch (err) { console.error(err); }
                            }}
                          >
                            Save
                          </button>
                          <button style={styles.navBtn} onClick={() => setEditingPost(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* COMMENTS ACCORDION AREA */}
                    {isCommentsExpanded && (
                      <div style={styles.commentSection}>
                        <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
                          <input 
                            style={{ ...styles.input, marginBottom: 0, flex: 1 }} 
                            placeholder="Write a constructive comment..." 
                            value={commentInputs[post.id] || ""}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                          />
                          <button 
                            style={styles.primaryBtn}
                            onClick={async () => {
                              const text = commentInputs[post.id];
                              if (!text || !text.trim()) return;
                              try {
                                const res = await fetch(`http://localhost:8080/api/posts/${post.id}/comments`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ content: text })
                                });
                                if (res.ok) {
                                  const newComment = await res.json();
                                  setPosts(prev => prev.map(p => p.id === post.id ? { ...p, comments: [...(p.comments || []), newComment] } : p));
                                  setCommentInputs(prev => ({ ...prev, [post.id]: "" }));
                                }
                              } catch (err) { console.error("Comment submission error", err); }
                            }}
                          >
                            Reply
                          </button>
                        </div>

                        {/* List rendered comments */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {postComments.map((comment) => (
                            <div key={comment.id} style={styles.commentRow}>
                              <b style={{ color: "#2563eb", fontSize: 13 }}>@{comment.user?.username || "builder"}:</b>
                              <span style={{ fontSize: 13, marginLeft: 6, color: "#e5e7eb" }}>{comment.content}</span>
                            </div>
                          ))}
                          {postComments.length === 0 && (
                            <p style={{ opacity: 0.4, fontSize: 12, textAlign: "center" }}>Be the first to spark context on this post!</p>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}

              {posts.length === 0 && <p style={{ opacity: 0.5 }}>No posts found on the feed.</p>}

              {hasMore && posts.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <button style={styles.primaryBtn} onClick={loadMorePosts} disabled={loadingMore}>
                    {loadingMore ? "Loading..." : "Load More Posts"}
                  </button>
                </div>
              )}
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
            
            <div style={{ marginBottom: 15 }}>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file) {
                    setMediaPreview(URL.createObjectURL(file));
                  } else {
                    setMediaPreview(null);
                  }
                }}
              />
            </div>

            {mediaPreview && selectedFile && (
              <div style={{ marginBottom: 15, position: 'relative', maxWidth: '100%' }}>
                {selectedFile.type.startsWith("video/") ? (
                  <video src={mediaPreview} controls style={{ width: "100%", maxHeight: 300, borderRadius: 8 }} />
                ) : (
                  <img src={mediaPreview} alt="Preview" style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 8 }} />
                )}
              </div>
            )}

            <button 
              style={styles.primaryBtn} 
              onClick={createPost}
              disabled={uploadingMedia}
            >
              {uploadingMedia ? "Uploading & Publishing..." : "Publish"}
            </button>
          </div>
        )}

        {/* PROFILE */}
        {page === "profile" && (
          <div style={{ maxWidth: 500 }}>
            <h1>Profile</h1>
            {user ? (
              <>
                {!editingProfile ? (
                  <div style={styles.profileCard}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                      <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        background: "#2563eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        fontSize: 28,
                        overflow: "hidden"
                      }}>
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          (user.username || "U").charAt(0).toUpperCase()
                        )}
                      </div>
                    </div>

                    <p><b>Email:</b> {user.email}</p>
                    <p><b>Username:</b> {user.username || "N/A"}</p>
                    <p><b>Bio:</b> {user.bio || "—"}</p>
                    <p><b>Skills:</b> {user.skills || "—"}</p>
                    <p><b>Location:</b> {user.location || "—"}</p>
                    <button
                      style={{ ...styles.primaryBtn, marginTop: 15 }}
                      onClick={() => {
                        setProfileForm({
                          username: user.username || "",
                          bio: user.bio || "",
                          skills: user.skills || "",
                          location: user.location || "",
                        });
                        setMediaPreview(user.avatar_url || null);
                        setSelectedFile(null);
                        setEditingProfile(true);
                      }}
                    >
                      Edit Profile
                    </button>
                  </div>
                ) : (
                  <div style={styles.profileCard}>
                    <label style={styles.label}>Profile Picture</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 15 }}>
                      <div style={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        background: "#374151",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden"
                      }}>
                        {mediaPreview ? (
                          <img src={mediaPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 12, opacity: 0.5 }}>No Image</span>
                        )}
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setSelectedFile(file);
                          if (file) {
                            setMediaPreview(URL.createObjectURL(file));
                          }
                        }} 
                      />
                    </div>

                    <label style={styles.label}>Username</label>
                    <input style={styles.input} value={profileForm.username} onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value }))} />

                    <label style={styles.label}>Bio</label>
                    <textarea style={styles.textarea} value={profileForm.bio} onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))} />

                    <label style={styles.label}>Skills</label>
                    <input style={styles.input} value={profileForm.skills} onChange={(e) => setProfileForm((f) => ({ ...f, skills: e.target.value }))} />

                    <label style={styles.label}>Location</label>
                    <input style={styles.input} value={profileForm.location} onChange={(e) => setProfileForm((f) => ({ ...f, location: e.target.value }))} />

                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                      <button
                        style={styles.primaryBtn}
                        disabled={uploadingMedia}
                        onClick={async () => {
                          setUploadingMedia(true);
                          try {
                            let currentAvatarUrl = user.avatar_url || "";

                            if (selectedFile) {
                              const formData = new FormData();
                              formData.append("file", selectedFile);

                              const uploadRes = await fetch("http://localhost:8080/api/upload", {
                                method: "POST",
                                headers: { Authorization: `Bearer ${token}` },
                                body: formData
                              });

                              if (uploadRes.ok) {
                                const uploadData = await uploadRes.json();
                                currentAvatarUrl = uploadData.url;
                              } else {
                                alert("Failed to upload avatar image.");
                                setUploadingMedia(false);
                                return;
                              }
                            }

                            const profilePayload = {
                              ...profileForm,
                              avatar_url: currentAvatarUrl
                            };

                            const res = await fetch(
                              `http://localhost:8080/api/users/${user.id}`,
                              {
                                method: "PUT",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify(profilePayload),
                              }
                            );
                            
                            if (!res.ok) { alert("Failed to update profile"); return; }
                            const updated = await res.json();
                            setUser(updated);
                            setEditingProfile(false);
                            setSelectedFile(null);
                            setMediaPreview(null);
                          } catch (err) {
                            console.error(err);
                            alert("Error updating profile");
                          } finally {
                            setUploadingMedia(false);
                          }
                        }}
                      >
                        {uploadingMedia ? "Saving..." : "Save"}
                      </button>
                      <button style={styles.navBtn} onClick={() => { setEditingProfile(false); setSelectedFile(null); setMediaPreview(null); }}>Cancel</button>
                    </div>
                  </div>
                )}
              </>
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
// STYLES
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
  postHeader: { display: "flex", gap: 10, alignItems: "center", marginBottom: 10, position: "relative" },
  avatar: { width: 35, height: 35, borderRadius: "50%", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", overflow: "hidden" },
  postContent: { fontSize: 14, lineHeight: 1.5 },
  timestamp: { fontSize: 12, opacity: 0.5 },
  createBox: { maxWidth: 600 },
  textarea: { width: "100%", height: 120, marginTop: 10, marginBottom: 10, padding: 10, borderRadius: 8, border: "1px solid #374151", background: "#111827", color: "#fff" },
  input: { display: "block", width: "100%", padding: 10, marginBottom: 10, borderRadius: 6, border: "1px solid #333", background: "#0f172a", color: "#fff", boxSizing: "border-box" },
  primaryBtn: { background: "#2563eb", color: "#fff", border: "none", padding: "10px 15px", borderRadius: 6, cursor: "pointer" },
  authPage: { display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#0b0f19" },
  authCard: { width: 320, padding: 20, borderRadius: 10, background: "#111827", border: "1px solid #1f2937" },
  profileCard: { background: "#111827", padding: 15, borderRadius: 10, maxWidth: 400 },
  label: { display: "block", marginTop: 10, marginBottom: 4, fontSize: 13, opacity: 0.7 },
  
  actionBar: { display: "flex", justifyContent: "space-between", marginTop: 15, paddingTop: 10, borderTop: "1px solid #1f2937" },
  actionBtn: { background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 5 },
  iconBtn: { background: "transparent", border: "none", color: "#9ca3af", fontSize: 18, cursor: "pointer", padding: "0 5px" },
  dropdownMenu: { position: "absolute", right: 0, top: 25, background: "#1f2937", border: "1px solid #374151", borderRadius: 6, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", zIndex: 10, minWidth: 120, overflow: "hidden" },
  dropdownItem: { display: "block", width: "100%", padding: "8px 12px", background: "transparent", border: "none", color: "#fff", textAlign: "left", cursor: "pointer", fontSize: 12, transition: "background 0.2s" },
  commentSection: { marginTop: 15, padding: "15px 0 0 0", borderTop: "1px dashed #1f2937" },
  commentRow: { background: "#1f2937", padding: "8px 12px", borderRadius: 6, display: "flex", alignItems: "baseline" },
};