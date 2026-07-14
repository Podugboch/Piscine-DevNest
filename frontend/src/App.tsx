import { useState, useEffect } from "react";
import { timeAgo } from "./utils/timeAgo";
import "./App.css";

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
      <div className="auth-page">
        <div className="auth-card">
          <h1>DevNest</h1>
          <p className="auth-subtitle">
            {authMode === "login" ? "A live community for Piscine builders" : "Create a new developer profile"}
          </p>

          {authMode === "register" && (
            <input
              className="input"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}

          <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          {authMode === "login" ? (
            <>
              <button className="primary-btn" style={{ width: "100%" }} onClick={login}>Login</button>
              <p className="auth-switch">
                New to DevNest?{" "}
                <span className="link" onClick={() => setAuthMode("register")}>
                  Sign up
                </span>
              </p>
            </>
          ) : (
            <>
              <button className="primary-btn" style={{ width: "100%" }} onClick={handleRegister}>Create Account</button>
              <p className="auth-switch">
                Already registered?{" "}
                <span className="link" onClick={() => setAuthMode("login")}>
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
    <div className="app">
      {/* SIDEBAR */}
      <div className="sidebar">
        <h2>DevNest</h2>
        <button className={page === "feed" ? "active-nav" : "nav-btn"} onClick={() => setPage("feed")}>Feed</button>
        <button className={page === "create" ? "active-nav" : "nav-btn"} onClick={() => setPage("create")}>Create Post</button>
        <button className={page === "profile" ? "active-nav" : "nav-btn"} onClick={() => setPage("profile")}>Profile</button>
        <div style={{ marginTop: "auto" }}>
          <button
            className="logout-btn"
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
      <div className="main-content">

        {/* FEED */}
        {page === "feed" && (
          <>
            <h1>Live Feed</h1>
            <p className="page-subtitle">What's happening in DevNest</p>

            <div className="feed">
              {posts.map((post) => {
                const displayName = post.user?.username || "Anonymous";
                const postComments = post.comments || [];
                const isDropdownOpen = activeDropdown === post.id;
                const isCommentsExpanded = expandedComments[post.id] || false;

                return (
                  <div key={post.id} className="post-card">

                    {/* POST HEADER WITH DROPDOWN MENU */}
                    <div className="post-header">
                      <div className="avatar">
                        {post.user?.avatar_url ? (
                          <img src={post.user.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <b>{displayName}</b>
                        <div className="timestamp">
                          {post.created_at ? timeAgo(post.created_at) : "Just now"}
                        </div>
                      </div>

                      <div style={{ marginLeft: "auto", position: "relative" }}>
                        <button
                          className="icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdown(isDropdownOpen ? null : post.id);
                          }}
                        >
                          ⋮
                        </button>

                        {isDropdownOpen && (
                          <div className="dropdown-menu">
                            <button
                              className="dropdown-item"
                              onClick={() => { setEditingPost(post); setEditText(post.content); setActiveDropdown(null); }}
                            >
                              ✏️ Edit Post
                            </button>
                            <button
                              className="dropdown-item danger"
                              onClick={() => { deletePost(post.id); setActiveDropdown(null); }}
                            >
                              🗑️ Delete Post
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CONTENT */}
                    <p className="post-content">{post.content}</p>

                    {/* MEDIA */}
                    {post.media_url && (
                      <div className="post-media">
                        {post.media_url.match(/\.(mp4|webm|ogg|mov|MOV|mp4\?|mov\?)/i) || post.media_url.includes("video") ? (
                          <video src={post.media_url} controls />
                        ) : (
                          <img src={post.media_url} alt="Post asset" />
                        )}
                      </div>
                    )}

                    {/* INTERACTION ACTION BAR */}
                    <div className="action-bar">
                      <button
                        className="action-btn"
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
                        className="action-btn"
                        onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !isCommentsExpanded }))}
                      >
                        💬 {postComments.length} Comments
                      </button>

                      <button
                        className="action-btn"
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
                      <div className="edit-panel">
                        <h3>Edit Post</h3>
                        <textarea className="textarea" value={editText} onChange={(e) => setEditText(e.target.value)} />
                        <div className="edit-panel-actions">
                          <button
                            className="primary-btn"
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
                          <button className="secondary-btn" onClick={() => setEditingPost(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* COMMENTS ACCORDION AREA */}
                    {isCommentsExpanded && (
                      <div className="comment-section">
                        <div className="comment-form">
                          <input
                            className="input"
                            placeholder="Write a constructive comment..."
                            value={commentInputs[post.id] || ""}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                          />
                          <button
                            className="primary-btn"
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

                        <div className="comment-list">
                          {postComments.map((comment) => (
                            <div key={comment.id} className="comment-row">
                              <b className="comment-author">@{comment.user?.username || "builder"}:</b>
                              <span className="comment-text">{comment.content}</span>
                            </div>
                          ))}
                          {postComments.length === 0 && (
                            <p className="comment-empty">Be the first to spark context on this post!</p>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}

              {posts.length === 0 && <p className="feed-empty">No posts found on the feed.</p>}

              {hasMore && posts.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <button className="primary-btn" onClick={loadMorePosts} disabled={loadingMore}>
                    {loadingMore ? "Loading..." : "Load More Posts"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* CREATE */}
        {page === "create" && (
          <div className="create-box">
            <h1>Create Post</h1>
            <textarea
              className="textarea"
              placeholder="Share a win, bug, idea, or question..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
            />

            <div className="file-input-wrapper">
              <label className="file-input-label">
                📎 Attach media
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
              </label>
              <span className="file-name">{selectedFile ? selectedFile.name : "No file chosen"}</span>
            </div>

            {mediaPreview && selectedFile && (
              <div style={{ marginBottom: 15, position: "relative", maxWidth: "100%" }}>
                {selectedFile.type.startsWith("video/") ? (
                  <video src={mediaPreview} controls style={{ width: "100%", maxHeight: 300, borderRadius: 8 }} />
                ) : (
                  <img src={mediaPreview} alt="Preview" style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 8 }} />
                )}
              </div>
            )}

            <button
              className="primary-btn"
              onClick={createPost}
              disabled={uploadingMedia}
            >
              {uploadingMedia ? "Uploading & Publishing..." : "Publish"}
            </button>
          </div>
        )}

        {/* PROFILE */}
        {page === "profile" && (
          <div className="profile-page">
            <h1>Profile</h1>
            {user ? (
              <>
                {!editingProfile ? (
                  <div className="profile-card">
                    <div className="profile-avatar-row">
                      <div className="avatar avatar-lg">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          (user.username || "U").charAt(0).toUpperCase()
                        )}
                      </div>
                    </div>

                    <p className="profile-field"><b>Email:</b> {user.email}</p>
                    <p className="profile-field"><b>Username:</b> {user.username || "N/A"}</p>
                    <p className="profile-field"><b>Bio:</b> {user.bio || "—"}</p>
                    <p className="profile-field"><b>Skills:</b> {user.skills || "—"}</p>
                    <p className="profile-field"><b>Location:</b> {user.location || "—"}</p>
                    <button
                      className="primary-btn"
                      style={{ marginTop: 15 }}
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
                  <div className="profile-card">
                    <label className="label">Profile Picture</label>
                    <div className="profile-avatar-edit-row">
                      <div className="avatar-placeholder">
                        {mediaPreview ? (
                          <img src={mediaPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span>No Image</span>
                        )}
                      </div>
                      <label className="file-input-label">
                        📎 Change photo
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
                      </label>
                    </div>

                    <label className="label">Username</label>
                    <input className="input" value={profileForm.username} onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value }))} />

                    <label className="label">Bio</label>
                    <textarea className="textarea" value={profileForm.bio} onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))} />

                    <label className="label">Skills</label>
                    <input className="input" value={profileForm.skills} onChange={(e) => setProfileForm((f) => ({ ...f, skills: e.target.value }))} />

                    <label className="label">Location</label>
                    <input className="input" value={profileForm.location} onChange={(e) => setProfileForm((f) => ({ ...f, location: e.target.value }))} />

                    <div className="form-actions">
                      <button
                        className="primary-btn"
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
                      <button className="secondary-btn" onClick={() => { setEditingProfile(false); setSelectedFile(null); setMediaPreview(null); }}>Cancel</button>
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