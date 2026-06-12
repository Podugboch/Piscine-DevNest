package handlers

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"piscine-devnest/internal/model"
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

	// PROTECTED ROUTES (JWT REQUIRED)
	protected := api.Group("/", utils.JWTMiddleware())
	{
		protected.GET("/users", h.GetUsers)
		protected.GET("/users/:id", h.GetUser)
		protected.PUT("/users/:id", h.UpdateUser)
		protected.DELETE("/users/:id", h.DeleteUser)

		protected.GET("/resources", h.GetResources)
		protected.GET("/resources/:id", h.GetResource)
		protected.POST("/resources", h.CreateResource)
		protected.PUT("/resources/:id", h.UpdateResource)
		protected.DELETE("/resources/:id", h.DeleteResource)
	}

	// WebSocket (optional protection can be added later)
	r.GET("/ws", func(c *gin.Context) {
		h.Hub.HandleConnections(c.Writer, c.Request)
	})
}

// ---------------------- BASIC ----------------------
func (h *Handler) Ping(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "pong"})
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

	if !validateEmail(input.Email) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email"})
		return
	}

	if !validatePassword(input.Password) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password too short"})
		return
	}

	if !validateUsername(input.Username) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username too short"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

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

	if input.Email != "" {
		if !validateEmail(input.Email) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email"})
			return
		}
		user.Email = input.Email
	}

	if input.Username != "" {
		if !validateUsername(input.Username) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid username"})
			return
		}
		user.Username = input.Username
	}

	if input.Password != "" {
		if !validatePassword(input.Password) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "password too short"})
			return
		}

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
	if err := h.DB.Delete(&model.User{}, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.Status(http.StatusNoContent)
}

// ---------------------- LOGIN (FIXED JWT) ----------------------
func (h *Handler) Login(c *gin.Context) {
	var input LoginInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user model.User
if err := h.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{
                "error": "user not found",
        })
        return
}

if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{
                "error": "password mismatch",
        })
        return
}

	token, err := utils.GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
	})
}

// ---------------------- RESOURCE HANDLERS ----------------------
func (h *Handler) GetResources(c *gin.Context)   {}
func (h *Handler) GetResource(c *gin.Context)    {}
func (h *Handler) CreateResource(c *gin.Context) {}
func (h *Handler) UpdateResource(c *gin.Context) {}
func (h *Handler) DeleteResource(c *gin.Context) {}

// ---------------------- VALIDATION ----------------------
func validateEmail(email string) bool {
	re := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return re.MatchString(email)
}

func validatePassword(password string) bool {
	return len(password) >= 6
}

func validateUsername(username string) bool {
	return len(username) >= 3
}
