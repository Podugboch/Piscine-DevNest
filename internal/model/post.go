package model

import (
    "time"
)

type Comment struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    PostID    uint      `gorm:"index" json:"post_id"`
    UserID    uint      `gorm:"index" json:"user_id"`
    User      *User     `gorm:"foreignKey:UserID" json:"user"` 
    Content   string    `gorm:"not null" json:"content"`
    CreatedAt time.Time `json:"created_at"`
}

type Post struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    UserID    uint      `gorm:"index" json:"user_id"`
    User      *User     `gorm:"foreignKey:UserID" json:"user"` 
    Content   string    `json:"content"`
    MediaURL  string    `json:"media_url"`
    Likes     int       `gorm:"default:0" json:"likes"`
    Comments  []Comment `gorm:"foreignKey:PostID" json:"comments"`
    CreatedAt time.Time `json:"created_at"`
}