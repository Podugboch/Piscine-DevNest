package model

import "time"

// Like represents a single user's like on a single post.
// Deliberately NOT using gorm.Model here — likes should be hard-deleted on
// unlike, not soft-deleted, otherwise the unique (user_id, post_id) index
// blocks re-liking after an unlike (the "deleted" row still counts).
type Like struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index:idx_user_post_like,unique" json:"user_id"`
	PostID    uint      `gorm:"not null;index:idx_user_post_like,unique;constraint:OnDelete:CASCADE" json:"post_id"`
	CreatedAt time.Time `json:"created_at"`
}
