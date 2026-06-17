package model

import "time"

type Post struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"user"`
	Content   string    `json:"content"`
	MediaURL  string    `json:"media_url"`
	Likes     int       `json:"likes"`
	CreatedAt time.Time `json:"created_at"`
}