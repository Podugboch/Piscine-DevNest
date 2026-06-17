package handlers

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"regexp"
	"strconv" // 👈 Added for parameter parsing
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"piscine-devnest/internal/model"
	"piscine-devnest/internal/storage"
	"piscine-devnest/internal/utils"
	"piscine-devnest/internal/ws"
)

type Handler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

// Constructor
func NewHandler(db *gorm.DB, hub *ws.Hub) *Handler {
	return &Handler{DB: db, Hub: hub}
}

// ---------------------- ROUTES ----------------------
func (h *Handler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")

	// PUBLIC ROUTES
	api.GET("/ping", h.Ping)
	api.POST("/users", h.CreateUser)
	api.POST("/login", h.Login)

	// PROTECTED ROUTES
	protected := api.Group("/", utils.JWTMiddleware())
	{
		// USERS
		protected.GET("/me", h.Me)
		protected.GET("/users", h.GetUsers)
		protected.GET("/users/:id", h.GetUser)
		protected.PUT("/users/:id", h.UpdateUser)
		protected.DELETE("/users/:id", h.DeleteUser)

		// RESOURCES
		protected.GET("/resources", h.GetResources)
		protected.GET("/resources/:id", h.GetResource)
		protected.POST("/resources", h.CreateResource)
		protected.PUT("/resources/:id", h.UpdateResource)
		protected.DELETE("/resources/:id", h.DeleteResource)

		// POSTS
		protected.GET("/posts", h.GetPosts)
		protected.POST("/posts", h.CreatePost)
		protected.PUT("/posts/:id", h.UpdatePost)
		protected.DELETE("/posts/:id", h.DeletePost)
		
		// LIKES & COMMENTS ✅ REGISTERED SMOOTHLY
		protected.POST("/posts/:id/like", h.LikePost)
		protected.POST("/posts/:id/comments", h.AddComment)

		// MEDIA UPLOAD
		protected.POST("/upload", h.UploadMedia)
	}

	// WebSocket
	r.GET("/ws", func(c *gin.Context) {
		h.Hub.HandleConnections(c.Writer, c.Request)
	})
}

// ---------------------- BASIC ----------------------
func (h *Handler) Ping(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "pong"})
}

// ---------------------- POSTS ----------------------
func (h *Handler) CreatePost(c *gin.Context) {
	var input struct {
		Content  string `json:"content"`
		MediaURL string `json:"media_url"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetUint("user_id")
	post := model.Post{
		UserID:   userID,
		Content:  input.Content,
		MediaURL: input.MediaURL,
	}

	if err := h.DB.Create(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create post"})
		return
	}

	h.DB.Preload("User", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "username", "name", "email", "avatar_url")
	}).First(&post, post.ID)

	c.JSON(http.StatusCreated, post)
}

func (h *Handler) UploadMedia(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file uploaded"})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	ext := filepath.Ext(header.Filename)
	filename := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), uuid.New().String()[:8], ext)

	publicURL, err := storage.UploadToSupabase("media", filename, data, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"url": publicURL})
}

func (h *Handler) GetPosts(c *gin.Context) {
	var posts []model.Post

	limit := 10
	page := 1

	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
	}

	offset := (page - 1) * limit

	if err := h.DB.
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "username", "name", "email", "avatar_url")
		}).
		Preload("Comments.User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "username", "name", "email", "avatar_url")
		}).
		Order("created_at desc").
		Limit(limit).
		Offset(offset).
		Find(&posts).Error; err != nil {

		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch posts"})
		return
	}

	c.JSON(http.StatusOK, posts)
}

func (h *Handler) UpdatePost(c *gin.Context) {
	var post model.Post

	if err := h.DB.First(&post, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "post not found",
		})
		return
	}

	var input struct {
		Content string `json:"content"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	post.Content = input.Content

	if err := h.DB.Save(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to update post",
		})
		return
	}

	h.DB.Preload("User", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "username", "name", "email", "avatar_url")
	}).First(&post, post.ID)

	c.JSON(http.StatusOK, post)
}

func (h *Handler) DeletePost(c *gin.Context) {
	var post model.Post

	if err := h.DB.First(&post, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "post not found",
		})
		return
	}

	if err := h.DB.Delete(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to delete post",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "post deleted",
	})
}

// ---------------------- INTERACTIONS ----------------------

func (h *Handler) LikePost(c *gin.Context) {
	id := c.Param("id")
	var post model.Post
	if err := h.DB.First(&post, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}
	
	h.DB.Model(&post).Update("likes", post.Likes+1)
	c.JSON(http.StatusOK, post)
}

func (h *Handler) AddComment(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetUint("user_id")

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Content required"})
		return
	}

	postIDNum, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post id"})
		return
	}

	comment := model.Comment{
		PostID:  uint(postIDNum),
		UserID:  userID,
		Content: req.Content,
	}

	if err := h.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save comment"})
		return
	}

	h.DB.Preload("User", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "username", "name", "email", "avatar_url")
	}).First(&comment, comment.ID)
	
	c.JSON(http.StatusOK, comment)
}

// ---------------------- INPUT STRUCTS ----------------------
type RegisterInput struct {
	Email    string `json:"email" binding:"required"`
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type UpdateInput struct {
	Email     string `json:"email"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	Name      string `json:"name"`
	Bio       string `json:"bio"`
	Skills    string `json:"skills"`
	Batch     string `json:"batch"`
	Location  string `json:"location"`
	AvatarURL string `json:"avatar_url"`
}

// ---------------------- USERS ----------------------
func (h *Handler) Me(c *gin.Context) {
	userID := c.GetUint("user_id")

	var user model.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *Handler) GetUsers(c *gin.Context) {
	var users []model.User
	h.DB.Find(&users)
	c.JSON(http.StatusOK, users)
}

func (h *Handler) GetUser(c *gin.Context) {
	var user model.User
	if err := h.DB.First(&user, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *Handler) CreateUser(c *gin.Context) {
	var input RegisterInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !h.validateEmail(input.Email) { // 👈 Prefixed with h.
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email"})
		return
	}

	if !h.validatePassword(input.Password) { // 👈 Prefixed with h.
		c.JSON(http.StatusBadRequest, gin.H{"error": "password too short"})
		return
	}

	if !h.validateUsername(input.Username) { // 👈 Prefixed with h.
		c.JSON(http.StatusBadRequest, gin.H{"error": "username too short"})
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)

	user := model.User{
		Email:    input.Email,
		Username: input.Username,
		Password: string(hash),
	}

	if err := h.DB.Create(&user).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func (h *Handler) UpdateUser(c *gin.Context) {
	var user model.User

	if err := h.DB.First(&user, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var input UpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Email != "" && !h.validateEmail(input.Email) { // 👈 Prefixed with h.
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email"})
		return
	}

	if input.Username != "" && !h.validateUsername(input.Username) { // 👈 Prefixed with h.
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid username"})
		return
	}

	if input.Password != "" && !h.validatePassword(input.Password) { // 👈 Prefixed with h.
		c.JSON(http.StatusBadRequest, gin.H{"error": "password too short"})
		return
	}

	if input.Email != "" {
		user.Email = input.Email
	}
	if input.Username != "" {
		user.Username = input.Username
	}
	if input.Password != "" {
		hash, _ := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		user.Password = string(hash)
	}

	user.Name = input.Name
	user.Bio = input.Bio
	user.Skills = input.Skills
	user.Batch = input.Batch
	user.Location = input.Location
	user.AvatarURL = input.AvatarURL

	h.DB.Save(&user)

	c.JSON(http.StatusOK, user)
}

func (h *Handler) DeleteUser(c *gin.Context) {
	h.DB.Delete(&model.User{}, c.Param("id"))
	c.Status(http.StatusNoContent)
}

// ---------------------- LOGIN ----------------------
func (h *Handler) Login(c *gin.Context) {
	var input LoginInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user model.User

	if err := h.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "password mismatch"})
		return
	}

	token, err := utils.GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}

// ---------------------- RESOURCE (EMPTY FOR NOW) ----------------------
func (h *Handler) GetResources(c *gin.Context)   {}
func (h *Handler) GetResource(c *gin.Context)    {}
func (h *Handler) CreateResource(c *gin.Context) {}
func (h *Handler) UpdateResource(c *gin.Context) {}
func (h *Handler) DeleteResource(c *gin.Context) {}

// ---------------------- VALIDATION ----------------------
func (h *Handler) validateEmail(email string) bool { // 👈 Attached to *Handler struct
	re := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return re.MatchString(email)
}

func (h *Handler) validatePassword(password string) bool { // 👈 Attached to *Handler struct
	return len(password) >= 6
}

func (h *Handler) validateUsername(username string) bool { // 👈 Attached to *Handler struct
	return len(username) >= 3
}