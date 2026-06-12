package model

import (
	"gorm.io/gorm"
	"time"
)

// Resource is a shared note / link / snippet
type Resource struct {
	gorm.Model
	Name        string `gorm:"not null"`
	Description string
	UserID      uint      `gorm:"not null"`
	ID          uint      `gorm:"primaryKey" json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	OwnerID     uint      `json:"owner_id"`
	Title       string    `json:"title"`
	Body        string    `json:"body"` // text or snippet
	Link        string    `json:"link"`
	Likes       int       `json:"likes"`
}
