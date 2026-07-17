import { useState, useEffect } from "react";
import { timeAgo } from "./utils/timeAgo";
import "./App.css";

type User = {
  id: number;
  username: string;
  email: string;
  name?: string;
  bio?: string;
  skills?: string;
  location?: string;
  avatar_url?: string;
  banner_url?: string;
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
  liked_by_me?: boolean;
  comments?: Comment[];
  parent_id?: number; 
  parent?: Post;      
};

type Notification = {
  id: number;
  user_id: number;
  actor_id: number;
  actor?: User;
  type: "like" | "comment" | "follow" | "mention" | "repost";
  post_id?: number;
  read: boolean;
  created_at: string;
};

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");

  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); 

  const getSystemTheme = (): "dark" | "light" =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" || saved === "light" ? saved : getSystemTheme();
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (localStorage.getItem("theme")) return; 
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // -----------------------------
  // USER SEARCH STATES
  // -----------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // -----------------------------
  // NOTIFICATIONS
  // -----------------------------
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  // -----------------------------
  // FEED FILTER CONFIGURATION
  // -----------------------------
  const [feedFilter, setFeedFilter] = useState<"all" | "following">("all");

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8080/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchNotifications();
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "notification" && data.notification) {
          setNotifications((prev) => [data.notification, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error", err);
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const markNotificationRead = async (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`http://localhost:8080/api/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const markAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch("http://localhost:8080/api/notifications/read-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("Failed to mark all notifications read", err);
    }
  };

  const notificationText = (n: Notification) => {
    const name = n.actor?.username || "Someone";
    if (n.type === "like") return `${name} liked your post`;
    if (n.type === "comment") return `${name} commented on your post`;
    if (n.type === "follow") return `${name} started following you`;
    if (n.type === "mention") return `${name} mentioned you in a post`;
    if (n.type === "repost") return `${name} reposted your post`; 
    return `${name} did something`;
  };

  const handleMentionClick = async (targetUsername: string) => {
    try {
      const res = await fetch(`http://localhost:8080/api/users/by-username/${targetUsername}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const targetUser: User = await res.json();
        openProfile(targetUser.id);
      } else if (res.status === 404) {
        alert(`User @${targetUsername} does not exist.`);
      } else {
        console.error("Failed to resolve mention username");
      }
    } catch (err) {
      console.error("Error fetching username details", err);
    }
  };

  const renderWithMentions = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const cleanUsername = part.substring(1);
        return (
          <span
            key={i}
            className="mention clickable-mention"
            onClick={(e) => {
              e.stopPropagation();
              handleMentionClick(cleanUsername);
            }}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderParentPost = (parent?: Post) => {
    if (!parent) return null;
    const parentName = parent.user?.username || "Anonymous";

    return (
      <div className="repost-embed-card">
        <div className="repost-embed-header">
          <div className="avatar search-avatar">
            {parent.user?.avatar_url ? (
              <img src={parent.user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              parentName.charAt(0).toUpperCase()
            )}
          </div>
          <b onClick={() => parent.user?.id && openProfile(parent.user.id)} style={{ cursor: "pointer" }}>
            {parentName}
          </b>
          <span className="timestamp" style={{ marginLeft: "auto" }}>
            {parent.created_at ? timeAgo(parent.created_at) : ""}
          </span>
        </div>
        <p className="post-content" style={{ fontSize: "13.5px", marginTop: "6px" }}>
          {renderWithMentions(parent.content)}
        </p>
        {parent.media_url && (
          <div className="post-media" style={{ marginTop: "8px" }}>
            {parent.media_url.match(/\.(mp4|webm|ogg|mov)/i) || parent.media_url.includes("video") ? (
              <video src={parent.media_url} style={{ maxHeight: "200px" }} />
            ) : (
              <img src={parent.media_url} alt="" style={{ maxHeight: "200px", objectFit: "contain" }} />
            )}
          </div>
        )}
      </div>
    );
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next); 
      return next;
    });
  };

  const [user, setUser] = useState<User | null>(null);

  const [page, setPage] = useState<"feed" | "create" | "profile">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");

  // -----------------------------
  // PROFILE VIEW (self or others)
  // -----------------------------
  const [viewedUserId, setViewedUserId] = useState<number | null>(null);
  const [profileData, setProfileData] = useState<{
    user: User;
    follower_count: number;
    following_count: number;
    post_count: number;
    is_following: boolean;
    is_self: boolean;
  } | null>(null);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const openProfile = (userId: number) => {
    setViewedUserId(userId);
    setPage("profile");
    setMobileMenuOpen(false); 
  };

  const fetchProfile = async (userId: number) => {
    setProfileLoading(true);
    try {
      const [profileRes, postsRes] = await Promise.all([
        fetch(`http://localhost:8080/api/users/${userId}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:8080/api/users/${userId}/posts?page=1&limit=30`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfileData(data);
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        setProfilePosts(data || []);
      }
    } catch (err) {
      console.error("Failed to load profile", err);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (page !== "profile" || !token) return;
    const targetId = viewedUserId ?? user?.id;
    if (targetId) fetchProfile(targetId);
  }, [page, viewedUserId, token]);

  const toggleFollow = async () => {
    if (!profileData || profileData.is_self) return;
    setFollowBusy(true);
    const targetId = profileData.user.id;
    try {
      const res = await fetch(
        `http://localhost:8080/api/users/${targetId}/follow`,
        {
          method: profileData.is_following ? "DELETE" : "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        setProfileData((prev) =>
          prev
            ? {
                ...prev,
                is_following: !prev.is_following,
                follower_count: prev.is_following
                  ? prev.follower_count - 1
                  : prev.follower_count + 1,
              }
            : prev
        );
      }
    } catch (err) {
      console.error("Follow toggle error", err);
    } finally {
      setFollowBusy(false);
    }
  };

  // -----------------------------
  // FOLLOWERS / FOLLOWING LIST MODAL
  // -----------------------------
  type FollowListUser = User & { is_following: boolean };
  const [followListModal, setFollowListModal] = useState<{ type: "followers" | "following"; userId: number } | null>(null);
  const [followListUsers, setFollowListUsers] = useState<FollowListUser[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const openFollowList = async (type: "followers" | "following", userId: number) => {
    setFollowListModal({ type, userId });
    setFollowListLoading(true);
    try {
      const res = await fetch(`http://localhost:8080/api/users/${userId}/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFollowListUsers(data || []);
      }
    } catch (err) {
      console.error("Failed to load follow list", err);
    } finally {
      setFollowListLoading(false);
    }
  };

  const toggleFollowInList = async (targetUser: FollowListUser) => {
    try {
      const res = await fetch(`http://localhost:8080/api/users/${targetUser.id}/follow`, {
        method: targetUser.is_following ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setFollowListUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, is_following: !u.is_following } : u))
        );
        if (profileData && profileData.user.id === (viewedUserId ?? user?.id)) {
          fetchProfile(profileData.user.id);
        }
      }
    } catch (err) {
      console.error("Follow toggle error", err);
    }
  };

  const goToProfileFromList = (userId: number) => {
    setFollowListModal(null);
    openProfile(userId);
  };

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const [pageNumber, setPageNumber] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [activeShareDropdown, setActiveShareDropdown] = useState<number | null>(null);
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

  const fetchPosts = async (pageNum: number = 1, filterType = feedFilter) => {
    try {
      const isFollowing = filterType === "following" ? "&following=true" : "";
      const res = await fetch(
        `http://localhost:8080/api/posts?page=${pageNum}&limit=10${isFollowing}`,
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
    }
  };

  useEffect(() => {
    if (!token) return;
    setPageNumber(1);
    setHasMore(true);
    fetchPosts(1, feedFilter);
  }, [feedFilter, token]);

  useEffect(() => {
    if (!token) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data || []);
        }
      } catch (err) {
        console.error("Search error", err);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, token]);

  const loadMorePosts = async () => {
    setLoadingMore(true);
    const nextPage = pageNumber + 1;
    await fetchPosts(nextPage);
    setPageNumber(nextPage);
    setLoadingMore(false);
  };

  useEffect(() => {
    const closeAllDropdowns = () => {
      setActiveDropdown(null);
      setActiveShareDropdown(null); 
      setSearchFocused(false);
    };
    window.addEventListener("click", closeAllDropdowns);
    return () => window.removeEventListener("click", closeAllDropdowns);
  }, []);

  const handleRepostAction = async (postId: number) => {
    if (!window.confirm("Do you want to repost this to your feed?")) return;
    try {
      const res = await fetch(`http://localhost:8080/api/posts/${postId}/repost`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Post reposted successfully!");
        fetchPosts(1);
        if (profileData) fetchProfile(profileData.user.id);
      }
    } catch (err) {
      console.error("Repost error", err);
    }
  };

  const handleCopyLinkAction = (postId: number) => {
    const linkStr = `${window.location.origin}/posts/${postId}`;
    navigator.clipboard.writeText(linkStr);
    alert("Post link copied to clipboard! Share it with fellow builders.");
  };

  const handleNativeShareAction = async (post: Post) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.user?.username || "Builder"}`,
          text: post.content,
          url: `${window.location.origin}/posts/${post.id}`
        });
      } catch (err) {
        console.error("Error invoking native share handler", err);
      }
    } else {
      handleCopyLinkAction(post.id);
    }
  };

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

  const deleteProfilePost = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8080/api/posts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProfilePosts((prev) => prev.filter((p) => p.id !== id));
        setProfileData((prev) => (prev ? { ...prev, post_count: prev.post_count - 1 } : prev));
      } else {
        alert("Failed to delete post");
      }
    } catch (err) {
      console.error(err);
    }
  };

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
          <h1>Nesty</h1>
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
                New to Nesty?{" "}
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

  const navigateToPage = (targetPage: "feed" | "create" | "profile", resetUser = false) => {
    if (resetUser) setViewedUserId(null);
    setPage(targetPage);
    setMobileMenuOpen(false); 
  };

  return (
    <div className="app">
      {/* MOBILE RESPONSIVE FLOATING HEADER BAR */}
      <div className="mobile-top-bar">
        <button className="hamburger-btn" onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setNotifOpen(false); }}>
          ☰
        </button>
        <h2 className="mobile-bar-title" onClick={() => navigateToPage("feed")}>Nesty</h2>
        <div className="mobile-bar-spacer" />
      </div>

      {/* GLOBAL BLUR OVERLAY WHEN NOTIFICATIONS PANEL IS ACTIVE */}
      {notifOpen && (
        <div className="global-blur-overlay" onClick={() => setNotifOpen(false)} />
      )}

      {/* DYNAMIC FOCUS OVERLAY FOR SIDEBAR HAMBURGER DRAWER */}
      {mobileMenuOpen && (
        <div className="global-blur-overlay" style={{ zIndex: 84 }} onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* SIDEBAR NAVIGATION CONTROLLER */}
      <div className={`sidebar ${mobileMenuOpen ? "open-drawer" : ""}`}>
        <h2>Nesty</h2>

        {/* LIVE SEARCH BAR */}
        <div 
          className="search-container" 
          onFocus={() => setSearchFocused(true)}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            className="input search-input"
            placeholder="Search users..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchFocused && (searchQuery.trim() !== "") && (
            <div className="search-results-dropdown">
              {searchResults.length === 0 ? (
                <div className="search-empty">No builders found</div>
              ) : (
                searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="search-result-row"
                    onClick={() => {
                      openProfile(u.id);
                      setSearchQuery("");
                      setSearchFocused(false);
                    }}
                  >
                    <div className="avatar search-avatar">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        u.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="search-result-info">
                      <b className="search-result-name">{u.name || u.username}</b>
                      <span className="search-result-username">@{u.username}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button className={page === "feed" ? "active-nav" : "nav-btn"} onClick={() => navigateToPage("feed")}>Feed</button>
        <button className={page === "create" ? "active-nav" : "nav-btn"} onClick={() => navigateToPage("create")}>Create Post</button>
        <button className={page === "profile" ? "active-nav" : "nav-btn"} onClick={() => navigateToPage("profile", true)}>Profile</button>

        <div className="notif-bell-wrapper">
          <button
            className="nav-btn notif-bell-btn"
            onClick={(e) => {
              e.stopPropagation();
              setNotifOpen((prev) => !prev);
              setMobileMenuOpen(false);
            }}
          >
            🔔 Notifications
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>
        </div>

        <div style={{ marginTop: "auto" }}>
          <button
            className="secondary-btn"
            style={{ width: "100%", marginBottom: 10 }}
            onClick={toggleTheme}
          >
            {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
          <button
            className="logout-btn"
            onClick={() => {
              localStorage.removeItem("token");
              setToken(null);
              setUser(null);
              setMobileMenuOpen(false);
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* ==========================================================================
          🎯 NOTIFICATIONS PANEL ELEVATED TO APP ROOT HIERARCHY TIER
          ========================================================================== */}
      {notifOpen && (
        <div className="notif-dropdown global-notif-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="notif-dropdown-header">
            <b>Notifications</b>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={markAllNotificationsRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 && (
              <p className="notif-empty">No notifications yet.</p>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`notif-item${n.read ? "" : " unread"}`}
                onClick={() => {
                  if (!n.read) markNotificationRead(n.id);
                  setNotifOpen(false);
                  openProfile(n.actor_id);
                }}
              >
                <div className="notif-avatar">
                  {n.actor?.avatar_url ? (
                    <img src={n.actor.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    (n.actor?.username || "?").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="notif-body">
                  <span>{notificationText(n)}</span>
                  <div className="notif-time">{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN CONTENT CONTAINER */}
      <div className="main-content">

        {/* FEED */}
        {page === "feed" && (
          <>
            <h1></h1> {/*  Cleaned out completely! */}
            <p className="page-subtitle">What's up Nesters?</p>

            {/* 👇 TIMELINE TAB TOGGLE SWITCH CONTROL */}
            <div className="feed-toggle-bar" style={{ display: "flex", gap: "12px", width: "100%", maxWidth: "600px", marginBottom: "20px" }}>
              <button 
                className="primary-btn"
                style={{ 
                  flex: 1, 
                  padding: "10px", 
                  borderRadius: "var(--radius-sm)", 
                  border: "1px solid var(--border)", 
                  background: feedFilter === "all" ? "var(--accent)" : "transparent", 
                  color: feedFilter === "all" ? "#fff" : "var(--text)" 
                }}
                onClick={() => setFeedFilter("all")}
              >
                🌍 Global Timeline
              </button>
              <button 
                className="primary-btn"
                style={{ 
                  flex: 1, 
                  padding: "10px", 
                  borderRadius: "var(--radius-sm)", 
                  border: "1px solid var(--border)", 
                  background: feedFilter === "following" ? "var(--accent)" : "transparent", 
                  color: feedFilter === "following" ? "#fff" : "var(--text)" 
                }}
                onClick={() => setFeedFilter("following")}
              >
                🤝 Following Only
              </button>
            </div>

            <div className="feed">
              {posts.map((post) => {
                const displayName = post.user?.username || "Anonymous";
                const postComments = post.comments || [];
                const isDropdownOpen = activeDropdown === post.id;
                const isShareOpen = activeShareDropdown === post.id;

                return (
                  <div key={post.id} className="post-card">

                    <div className="post-header">
                      <div
                        className="avatar"
                        style={{ cursor: post.user?.id ? "pointer" : "default" }}
                        onClick={() => post.user?.id && openProfile(post.user.id)}
                      >
                        {post.user?.avatar_url ? (
                          <img src={post.user.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <b
                          style={{ cursor: post.user?.id ? "pointer" : "default" }}
                          onClick={() => post.user?.id && openProfile(post.user.id)}
                        >
                          {displayName}
                        </b>
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

                    <p className="post-content">{renderWithMentions(post.content)}</p>
                    {renderParentPost(post.parent)}

                    {post.media_url && (
                      <div className="post-media">
                        {post.media_url.match(/\.(mp4|webm|ogg|mov|MOV|mp4\?|mov\?)/i) || post.media_url.includes("video") ? (
                          <video src={post.media_url} controls />
                        ) : (
                          <img src={post.media_url} alt="Post asset" />
                        )}
                      </div>
                    )}

                    <div className="action-bar">
                      <button
                        className={`action-btn${post.liked_by_me ? " liked" : ""}`}
                        onClick={async () => {
                          try {
                            const res = await fetch(`http://localhost:8080/api/posts/${post.id}/like`, {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: data.likes, liked_by_me: data.liked } : p));
                            }
                          } catch (err) { console.error("Like error", err); }
                        }}
                      >
                        {post.liked_by_me ? "❤️" : "🤍"} {post.likes || 0} Likes
                      </button>

                      <button
                        className="action-btn"
                        onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !(expandedComments[post.id] || false) }))}
                      >
                        💬 {postComments.length} Comments
                      </button>

                      <div style={{ position: "relative" }}>
                        <button
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveShareDropdown(isShareOpen ? null : post.id);
                          }}
                        >
                          🔗 Share
                        </button>
                        {isShareOpen && (
                          <div className="dropdown-menu share-menu" onClick={(e) => e.stopPropagation()}>
                            <button className="dropdown-item" onClick={() => { handleRepostAction(post.id); setActiveShareDropdown(null); }}>
                              🔁 Repost inside feed
                            </button>
                            <button className="dropdown-item" onClick={() => { handleCopyLinkAction(post.id); setActiveShareDropdown(null); }}>
                              📋 Copy link string
                            </button>
                            <button className="dropdown-item" onClick={() => { handleNativeShareAction(post); setActiveShareDropdown(null); }}>
                              🌐 Share externally...
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

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

                    {(expandedComments[post.id] || false) && (
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
                              <b
                                className="comment-author"
                                style={{ cursor: comment.user?.id ? "pointer" : "default" }}
                                onClick={() => comment.user?.id && openProfile(comment.user.id)}
                              >
                                @{comment.user?.username || "builder"}:
                              </b>
                              <span className="comment-text">{renderWithMentions(comment.content)}</span>
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
          <div className="profile-page-full">
            {profileLoading && !profileData ? (
              <p>Loading profile...</p>
            ) : profileData ? (
              <>
                {!editingProfile ? (
                  <>
                    <div
                      className="profile-banner"
                      style={
                        profileData.user.banner_url
                          ? { backgroundImage: `url(${profileData.user.banner_url})` }
                          : undefined
                      }
                    >
                      <div className="profile-avatar-overlap">
                        {profileData.user.avatar_url ? (
                          <img src={profileData.user.avatar_url} alt="Avatar" />
                        ) : (
                          <span>{(profileData.user.username || "U").charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                    </div>

                    <div className="profile-header-row">
                      <div>
                        <h2 className="profile-name">{profileData.user.name || profileData.user.username}</h2>
                        <div className="profile-username">@{profileData.user.username}</div>
                      </div>

                      {profileData.is_self ? (
                        <button
                          className="secondary-btn"
                          onClick={() => {
                            setProfileForm({
                              username: profileData.user.username || "",
                              bio: profileData.user.bio || "",
                              skills: profileData.user.skills || "",
                              location: profileData.user.location || "",
                            });
                            setMediaPreview(profileData.user.avatar_url || null);
                            setBannerPreview(profileData.user.banner_url || null);
                            setSelectedFile(null);
                            setBannerFile(null);
                            setEditingProfile(true);
                          }}
                        >
                          Edit Profile
                        </button>
                      ) : (
                        <button
                          className={profileData.is_following ? "secondary-btn" : "primary-btn"}
                          disabled={followBusy}
                          onClick={toggleFollow}
                        >
                          {followBusy ? "..." : profileData.is_following ? "Following" : "Follow"}
                        </button>
                      )}
                    </div>

                    {profileData.user.bio && <p className="profile-bio">{profileData.user.bio}</p>}

                    {profileData.user.location && (
                      <div className="profile-meta-row">📍 {profileData.user.location}</div>
                    )}

                    <div className="profile-stats">
                      <div className="profile-stat"><b>{profileData.post_count}</b> Posts</div>
                      <div className="profile-stat clickable" onClick={() => openFollowList("followers", profileData.user.id)}><b>{profileData.follower_count}</b> Followers</div>
                      <div className="profile-stat clickable" onClick={() => openFollowList("following", profileData.user.id)}><b>{profileData.following_count}</b> Following</div>
                    </div>

                    <div className="feed profile-post-list">
                      {profilePosts.map((p) => {
                        const displayName = p.user?.username || "Anonymous";
                        const postComments = p.comments || [];
                        const isDropdownOpen = activeDropdown === p.id;
                        const isProfileShareOpen = activeShareDropdown === p.id;
                        const isVideoFile = p.media_url && (p.media_url.match(/\.(mp4|webm|ogg|mov)/i) || p.media_url.includes("video"));

                        return (
                          <div key={p.id} className="post-card">
                            <div className="post-header">
                              <div className="avatar">
                                {p.user?.avatar_url ? (
                                  <img src={p.user.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  displayName.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <b>{displayName}</b>
                                <div className="timestamp">{p.created_at ? timeAgo(p.created_at) : "Just now"}</div>
                              </div>

                              {profileData.is_self && (
                                <div style={{ marginLeft: "auto", position: "relative" }}>
                                  <button
                                    className="icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdown(isDropdownOpen ? null : p.id);
                                    }}
                                  >
                                    ⋮
                                  </button>
                                  {isDropdownOpen && (
                                    <div className="dropdown-menu">
                                      <button
                                        className="dropdown-item"
                                        onClick={() => { setEditingPost(p); setEditText(p.content); setActiveDropdown(null); }}
                                      >
                                        ✏️ Edit Post
                                      </button>
                                      <button
                                        className="dropdown-item danger"
                                        onClick={() => { deleteProfilePost(p.id); setActiveDropdown(null); }}
                                      >
                                        🗑️ Delete Post
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <p className="post-content">{renderWithMentions(p.content)}</p>
                            {renderParentPost(p.parent)}

                            {p.media_url && (
                              <div className="post-media">
                                {isVideoFile ? (
                                  <video src={p.media_url} controls />
                                ) : (
                                  <img src={p.media_url} alt="Post asset" />
                                )}
                              </div>
                            )}

                            <div className="action-bar">
                              <button
                                className={`action-btn${p.liked_by_me ? " liked" : ""}`}
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`http://localhost:8080/api/posts/${p.id}/like`, {
                                      method: "POST",
                                      headers: { Authorization: `Bearer ${token}` },
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      setProfilePosts((prev) => prev.map((pp) => pp.id === p.id ? { ...pp, likes: data.likes, liked_by_me: data.liked } : pp));
                                    }
                                  } catch (err) { console.error("Like error", err); }
                                }}
                              >
                                {p.liked_by_me ? "❤️" : "🤍"} {p.likes || 0} Likes
                              </button>

                              <button
                                className="action-btn"
                                onClick={() => setExpandedComments((prev) => ({ ...prev, [p.id]: !(expandedComments[p.id] || false) }))}
                              >
                                💬 {postComments.length} Comments
                              </button>

                              <div style={{ position: "relative" }}>
                                <button
                                  className="action-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveShareDropdown(isProfileShareOpen ? null : p.id);
                                  }}
                                >
                                  🔗 Share
                                </button>
                                {isProfileShareOpen && (
                                  <div className="dropdown-menu share-menu" onClick={(e) => e.stopPropagation()}>
                                    <button className="dropdown-item" onClick={() => { handleRepostAction(p.id); setActiveShareDropdown(null); }}>
                                      🔁 Repost inside feed
                                    </button>
                                    <button className="dropdown-item" onClick={() => { handleCopyLinkAction(p.id); setActiveShareDropdown(null); }}>
                                      📋 Copy link string
                                    </button>
                                    <button className="dropdown-item" onClick={() => { handleNativeShareAction(p); setActiveShareDropdown(null); }}>
                                      🌐 Share externally...
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {editingPost?.id === p.id && (
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
                                        setProfilePosts((prev) => prev.map((pp) => pp.id === updatedPost.id ? { ...pp, content: updatedPost.content } : pp));
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

                            {(expandedComments[p.id] || false) && (
                              <div className="comment-section">
                                <div className="comment-form">
                                  <input
                                    className="input"
                                    placeholder="Write a constructive comment..."
                                    value={commentInputs[p.id] || ""}
                                    onChange={(e) => setCommentInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                  />
                                  <button
                                    className="primary-btn"
                                    onClick={async () => {
                                      const text = commentInputs[p.id];
                                      if (!text || !text.trim()) return;
                                      try {
                                        const res = await fetch(`http://localhost:8080/api/posts/${p.id}/comments`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                          body: JSON.stringify({ content: text }),
                                        });
                                        if (res.ok) {
                                          const newComment = await res.json();
                                          setProfilePosts((prev) => prev.map((pp) => pp.id === p.id ? { ...pp, comments: [...(pp.comments || []), newComment] } : pp));
                                          setCommentInputs((prev) => ({ ...prev, [p.id]: "" }));
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
                                      <b
                                        className="comment-author"
                                        style={{ cursor: comment.user?.id ? "pointer" : "default" }}
                                        onClick={() => comment.user?.id && openProfile(comment.user.id)}
                                      >
                                        @{comment.user?.username || "builder"}:
                                      </b>
                                      <span className="comment-text">{renderWithMentions(comment.content)}</span>
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

                      {profilePosts.length === 0 && (
                        <p className="feed-empty">No posts yet.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="profile-card">
                    <label className="label">Banner Image</label>
                    <div className="banner-edit-preview" style={bannerPreview ? { backgroundImage: `url(${bannerPreview})` } : undefined}>
                      {!bannerPreview && <span>No banner</span>}
                    </div>
                    <label className="file-input-label" style={{ marginBottom: 16 }}>
                      📎 Change banner
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setBannerFile(file);
                          if (file) setBannerPreview(URL.createObjectURL(file));
                        }}
                      />
                    </label>

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
                            let currentAvatarUrl = profileData.user.avatar_url || "";
                            let currentBannerUrl = profileData.user.banner_url || "";

                            if (selectedFile) {
                              const formData = new FormData();
                              formData.append("file", selectedFile);
                              const uploadRes = await fetch("http://localhost:8080/api/upload", {
                                method: "POST",
                                headers: { Authorization: `Bearer ${token}` },
                                body: formData,
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

                            if (bannerFile) {
                              const formData = new FormData();
                              formData.append("file", bannerFile);
                              const uploadRes = await fetch("http://localhost:8080/api/upload", {
                                method: "POST",
                                headers: { Authorization: `Bearer ${token}` },
                                body: formData,
                              });
                              if (uploadRes.ok) {
                                const uploadData = await uploadRes.json();
                                currentBannerUrl = uploadData.url;
                              } else {
                                alert("Failed to upload banner image.");
                                setUploadingMedia(false);
                                return;
                              }
                            }

                            const profilePayload = {
                              ...profileForm,
                              avatar_url: currentAvatarUrl,
                              banner_url: currentBannerUrl,
                            };

                            const res = await fetch(
                              `http://localhost:8080/api/users/${profileData.user.id}`,
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
                            setBannerFile(null);
                            setBannerPreview(null);
                            fetchProfile(updated.id);
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
                      <button className="secondary-btn" onClick={() => { setEditingProfile(false); setSelectedFile(null); setMediaPreview(null); setBannerFile(null); setBannerPreview(null); }}>Cancel</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p>Could not load profile.</p>
            )}
          </div>
        )}

      </div>

      {followListModal && (
        <div className="modal-overlay" onClick={() => setFollowListModal(null)}>
          <div className="follow-list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="follow-list-header">
              <b>{followListModal.type === "followers" ? "Followers" : "Following"}</b>
              <button className="icon-btn" onClick={() => setFollowListModal(null)}>✕</button>
            </div>
            <div className="follow-list-body">
              {followListLoading && <p className="notif-empty">Loading...</p>}
              {!followListLoading && followListUsers.length === 0 && (
                <p className="notif-empty">
                  {followListModal.type === "followers" ? "No followers yet." : "Not following anyone yet."}
                </p>
              )}
              {followListUsers.map((u) => (
                <div key={u.id} className="follow-list-row">
                  <div className="follow-list-user" onClick={() => goToProfileFromList(u.id)}>
                    <div className="avatar" style={{ width: 36, height: 36 }}>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        (u.username || "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    <span>{u.username}</span>
                  </div>
                  {u.id !== user?.id && (
                    <button
                      className={u.is_following ? "secondary-btn" : "primary-btn"}
                      style={{ padding: "6px 14px", fontSize: 13 }}
                      onClick={() => toggleFollowInList(u)}
                    >
                      {u.is_following ? "Following" : "Follow"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}