package controllers

import (
	"encoding/json"
	"net/http"
)

type ProfileResponse struct {
	Message string `json:"message"`
}

// GetProfilesHandler lists profiles
func GetProfilesHandler(w http.ResponseWriter, r *http.Request) {
	resp := ProfileResponse{Message: "Get profiles endpoint hit ✅"}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// CreateProfileHandler creates a new profile
func CreateProfileHandler(w http.ResponseWriter, r *http.Request) {
	resp := ProfileResponse{Message: "Create profile endpoint hit ✅"}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
