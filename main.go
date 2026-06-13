package main

import (
	"log"

	"github.com/gin-gonic/gin"
    // "github.com/gin-contrib/cors"
    "github.com/joho/godotenv"

	//"piscine-devnest/internal/app"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system env")
	}

	// Init DB + app layer
	//app := app.InitApp()

	// Gin router
	r := gin.Default()

	// Register routes
	//app.Handler.RegisterRoutes(r)

	// Start server
	r.Run(":8080")
}
