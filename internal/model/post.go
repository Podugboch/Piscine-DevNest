package model

import "time"

type Post struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id"`
	User      User      `json:"user"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	// Name     string `json:"name"`
	// Email    string `json:"email"`
}
