package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
)

var socket *net.TCPListener
var should_close = false
var connections = make(map[string]*net.TCPConn)

// Go has no way to identify private/local ip addresses so we do that manually
var private_ip_ranges_parsed []*net.IPNet
var private_ip_ranges = [8]string{
	"127.0.0.0/8",    // IPv4 loopback
	"10.0.0.0/8",     // RFC1918
	"172.16.0.0/12",  // RFC1918
	"192.168.0.0/16", // RFC1918
	"169.254.0.0/16", // RFC3927 link-local
	"::1/128",        // IPv6 loopback
	"fe80::/10",      // IPv6 link-local
	"fc00::/7",       // IPv6 unique local addr
}

func init_private_ip_ranges() {
	for _, cidr := range private_ip_ranges {
		_, block, _ := net.ParseCIDR(cidr)
		private_ip_ranges_parsed = append(private_ip_ranges_parsed, block)
	}
}

func is_private_ip(ip net.IP) bool {
	// Check for loopbacks, IPv6 link-local and unique-local addresses
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return true
	}

	// Check known private IP ranges
	for _, block := range private_ip_ranges_parsed {
		if block.Contains(ip) {
			return true
		}
	}

	return false
}

// Start up a TCP server and listening for extension messages
func create_server(address_str string) error {
	if local_only {
		init_private_ip_ranges()
	}

	address, err := net.ResolveTCPAddr("tcp", address_str)

	if err != nil {
		return fmt.Errorf("Unable to resolve address: %s", address_str)
	}

	socket, err = net.ListenTCP("tcp", address)

	if err != nil {
		return fmt.Errorf("Unable to create socket: %s", address_str)
	}

	s := fmt.Sprintf("Listening for TCP traffic on %s\n", address_str)
	log.Write([]byte(s))

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
			log.Write([]byte("Matched 'update'\n"))
			server_send(msg)
			break
		case "close":
			if !should_close {
				should_close = true
			}
			return errors.New("Received close message.")
		}
	}
}

// Receive incoming TCP connections
// Runs as a goroutine per-server
func server_accept() {
	log.Write([]byte("Started accepting TCP connections\n"))

	for {
		connection, err := socket.AcceptTCP()
		if err != nil {
			if !should_close {
				log.Write([]byte("Failed to accept incoming TCP connection\n"))
			}
			os.Exit(1)
		}

		address_str := connection.RemoteAddr().String()
		ip := net.ParseIP(address_str)

		if local_only && !is_private_ip(ip) {
			s := fmt.Sprintf("Ignored public TCP connection from %s\n", address_str)
			log.Write([]byte(s))

			connection.Close()
			return
		}

		connections[address_str] = connection

		s := fmt.Sprintf("New TCP connection from %s\n", address_str)
		log.Write([]byte(s))

		write_native(nativeMessage{
			Type:    "get_state",
			Address: address_str,
		})

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
	b, err := json.Marshal(msg)

	if err != nil {
		s := fmt.Sprintf("err marshaling %s\n", err.Error())
		log.Write([]byte(s))
	}

	s := fmt.Sprintf("marhaled: %s\n", string(b))
	log.Write([]byte(s))

	for address, connection := range connections {
		_, err = connection.Write([]byte((string(b) + "\n")))

		if err != nil {
			server_drop(connection.RemoteAddr().String(), "unable to write to socket, closing", err.Error())
		}

		s = fmt.Sprintf("Sent TCP message '%s' to %s\n", string(b), address)
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
