package app

import (
	"fmt"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"piscine-devnest/internal/handlers"
	"piscine-devnest/internal/model"
	"piscine-devnest/internal/ws"
)

func Run() error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return fmt.Errorf("DATABASE_URL is not set")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev-secret"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("connect db: %w", err)
	}

	if err := db.AutoMigrate(
	&model.User{},
	&model.Resource{},
	&model.Connection{},
	&model.Post{},  
	); err != nil {
	return fmt.Errorf("migrate: %w", err)
}

r := gin.Default()

r.Use(cors.New(cors.Config{
	AllowOrigins:     []string{"http://localhost:5173"},
	AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
	AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
	ExposeHeaders:    []string{"Content-Length"},
	AllowCredentials: true,
}))

	// WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// handler
	h := handlers.NewHandler(db, hub)

	h.RegisterRoutes(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	return r.Run(":" + port)
}
