package ws

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

// WebSocket upgrader (must be here!)
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// registration carries a new connection along with the authenticated user it belongs to
type registration struct {
	conn   *websocket.Conn
	userID uint
}

// userMessage is a targeted message for a single user (used for notifications)
type userMessage struct {
	userID  uint
	payload []byte
}

type Hub struct {
	Clients     map[*websocket.Conn]uint // conn -> owning userID
	BroadcastC  chan []byte
	Register    chan registration
	Unregister  chan *websocket.Conn
	SendToUserC chan userMessage
}

func NewHub() *Hub {
	return &Hub{
		Clients:     make(map[*websocket.Conn]uint),
		BroadcastC:  make(chan []byte),
		Register:    make(chan registration),
		Unregister:  make(chan *websocket.Conn),
		SendToUserC: make(chan userMessage),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case reg := <-h.Register:
			h.Clients[reg.conn] = reg.userID
			log.Println("client registered, user:", reg.userID)

		case conn := <-h.Unregister:
			if _, ok := h.Clients[conn]; ok {
				delete(h.Clients, conn)
				conn.Close()
				log.Println("client unregistered")
			}

		case message := <-h.BroadcastC:
			for conn := range h.Clients {
				conn.WriteMessage(websocket.TextMessage, message)
			}

		case um := <-h.SendToUserC:
			for conn, uid := range h.Clients {
				if uid == um.userID {
					conn.WriteMessage(websocket.TextMessage, um.payload)
				}
			}
		}
	}
}

// HandleConnections upgrades the HTTP connection to a WebSocket and registers
// it under the given authenticated userID.
func (h *Hub) HandleConnections(w http.ResponseWriter, r *http.Request, userID uint) {
	wsConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	h.Register <- registration{conn: wsConn, userID: userID}

	for {
		_, msg, err := wsConn.ReadMessage()
		if err != nil {
			h.Unregister <- wsConn
			break
		}
		h.Broadcast(string(msg))
	}
}

// Public method for handlers -- broadcasts to everyone (kept for anything using it already)
func (h *Hub) Broadcast(msg string) {
	h.BroadcastC <- []byte(msg)
}

// SendToUser delivers a message only to the given user's active connection(s).
// This is what notification creation will call.
func (h *Hub) SendToUser(userID uint, msg []byte) {
	h.SendToUserC <- userMessage{userID: userID, payload: msg}
}