package main

import (
	"fmt"
	"io"
	"net"
	"os"
)

var socket *net.TCPListener
var should_close = false
var connections = make(map[string]*net.TCPConn)

// Start up a TCP server and listening for extension messages
func create_server(address_str string) error {
	address, err := net.ResolveTCPAddr("tcp", address_str)

	if err != nil {
		return fmt.Errorf("Unable to resolve address: %s", address_str)
	}

	socket, err = net.ListenTCP("tcp", address)
	
	if err != nil {
		return fmt.Errorf("Unable to create socket: %s", address_str)
	}

  defer socket.Close()

  // Start accepting connections via TCP
  go server_accept()

  // Receive extension messages
	return receive_native()
}

// Receive native messages from extension
func receive_native() error {
	for {
    msg, err := read_native()
    
    if err != nil {
      return err
    }

		switch msg.Type {
    case "update":
      server_send(msg)
      break
    case "close":
      if !should_close {
        should_close = true
      }
      return fmt.Errorf("Received close message: %s", msg.Data.(string))
    }
	}
}

// Receive incoming TCP connections
// Runs as a goroutine per-server
func server_accept() {
  for {
    connection, err := socket.AcceptTCP()
    if err != nil {
      if !should_close {
        log.Write([]byte("Failed to accept incoming TCP connection\n"))
      }
      os.Exit(1)
    }

    address_str := connection.RemoteAddr().String()
    connections[address_str] = connection

    go server_receive(connection)
  }
}

// Receive messages from existing TCP connections
// Runs as a goroutine per-connected-client
func server_receive(connection *net.TCPConn) {
  address_str := connection.RemoteAddr().String()

  for {
    buf := make([]byte, 1024)
    buf_len, err := connection.Read(buf)

    if err != nil {
      if err == io.EOF {
        server_drop(address_str, "connection closed", err.Error())
      } else {
        server_drop(address_str, "unable to read from socket, closing", err.Error())
      }
      return
    }

    write_native(nativeMessage{
      Type: "command",
      Data: string(buf[:buf_len]),
    })
  }
}

// Send a message via TCP to it's given address
func server_send(msg nativeMessage) {

  for address, connection := range connections {

    _, err := connection.Write([]byte(msg.Data.([]byte)))

    if err != nil {
      server_drop(connection.RemoteAddr().String(), "unable to write to socket, closing", err.Error())
    }

    s := fmt.Sprintf("Sent TCP message to %s, message: %s\n", address, msg.Data.(string))
    log.Write([]byte(s))
  }
}

// Drop a given existing TCP connection
func server_drop(address_str string, message string, error_str string) {
  connection, found := connections[address_str]

  if !found {
    return
  }

  s := fmt.Sprintf("Dropping connection for %s, message: %s\n", address_str, message)
  log.Write([]byte(s))

  defer connection.Close()
  delete(connections, address_str)
}
