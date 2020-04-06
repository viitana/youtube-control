package main

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
)

const debug = true
const local_only = true

var log = map[bool]io.Writer{
	true:  os.Stderr,
	false: ioutil.Discard,
}[debug]

type nativeMessage struct {
	Type    string      `json:"type"`
	Data    interface{} `json:"data"`
	Address string      `json:"address"`
}

func write_native(msg nativeMessage) error {
	bytes, err := json.Marshal(msg)
	if err != nil {
		return errors.New("Unable to marshal message")
	}

	bytes_len := make([]byte, 4)

	binary.LittleEndian.PutUint32(bytes_len, uint32(len(bytes)))
	os.Stdout.Write(bytes_len)
	os.Stdout.Write(bytes)

	return nil
}

func read_native() (nativeMessage, error) {
	msg := nativeMessage{}

	msg_size := make([]byte, 4)
	msg_size_len, err := os.Stdin.Read(msg_size)

	if err != nil || msg_size_len != 4 {
		log.Write([]byte("Message input or input size unreadable\n"))
		return msg, fmt.Errorf("Message input or input size unreadable: %s", string(msg_size))
	}

	msg_len := binary.LittleEndian.Uint32(msg_size)

	message_bytes := make([]byte, msg_len)
	size, err := os.Stdin.Read(message_bytes)

	s := fmt.Sprintf("Received native message:\n%s\n", string(message_bytes))
	log.Write([]byte(s))

	if err != nil || size != int(msg_len) {
		log.Write([]byte("Unable to read message or size mismatch\n"))
		return msg, fmt.Errorf("Unable to read message or size mismatch: %s", string(message_bytes))
	}

	err = json.Unmarshal(message_bytes, &msg)

	if err != nil {
		log.Write([]byte("Unable to unmarshal message\n"))
		return msg, fmt.Errorf("Unable to unmarshal message: %s", string(message_bytes))
	}

	return msg, nil
}

func main() {
	log.Write([]byte("Starting\n"))

	msg, err := read_native()

	if err != nil || msg.Type != "init" {
		os.Exit(0)
	}

	//time.Sleep(2 * time.Second)

	err = create_server(msg.Data.(string))

	if err != nil {
		s := fmt.Sprintf("Error from create_server():\n%s\n", err.Error())
		log.Write([]byte(s))
		os.Exit(1)
	}
}
