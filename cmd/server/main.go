package main

import (
	"log"

	"github.com/joho/godotenv"

	"piscine-devnest/internal/app"
)

func main() {
	// Load environment variables FIRST
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found")
	}

	// Start app
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
