package model

import "time"

// Follow represents a directed follow relationship: FollowerID follows FollowingID.
// Deliberately NOT using gorm.Model here -- follows should be hard-deleted on
// unfollow, not soft-deleted, otherwise the unique (follower_id, following_id)
// index blocks re-following after an unfollow (the "deleted" row still counts).
type Follow struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	FollowerID  uint      `gorm:"not null;index:idx_follower_following,unique" json:"follower_id"`
	FollowingID uint      `gorm:"not null;index:idx_follower_following,unique" json:"following_id"`
	CreatedAt   time.Time `json:"created_at"`
}