package fs

import (
	"os"
	"path/filepath"
	"strings"
)

type Watcher struct {
	RootDir string
}

func NewWatcher(rootDir string) *Watcher {
	return &Watcher{RootDir: rootDir}
}

// FileNode represents a node in the project file tree
type FileNode struct {
	Name     string      `json:"name"`
	Path     string      `json:"path"`
	IsDir    bool        `json:"is_dir"`
	Children []*FileNode `json:"children,omitempty"`
}

// GetTree returns a serialized JSON-friendly tree of the directory
func (w *Watcher) GetTree() (*FileNode, error) {
	return buildTree(w.RootDir)
}

var ignoredDirs = map[string]bool{
	"node_modules":      true,
	".git":              true,
	".expo":             true,
	"dist":              true,
	"build":             true,
	".prompt":           true,
	".system_generated": true,
	".gemini":           true,
}

func buildTree(path string) (*FileNode, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	name := info.Name()
	if info.IsDir() && ignoredDirs[strings.ToLower(name)] {
		return nil, nil
	}

	node := &FileNode{
		Name:  name,
		Path:  path,
		IsDir: info.IsDir(),
	}

	if info.IsDir() {
		entries, err := os.ReadDir(path)
		if err != nil {
			return nil, err
		}
		for _, entry := range entries {
			if entry.IsDir() && ignoredDirs[strings.ToLower(entry.Name())] {
				continue
			}
			childPath := filepath.Join(path, entry.Name())
			childNode, err := buildTree(childPath)
			if err == nil && childNode != nil {
				node.Children = append(node.Children, childNode)
			}
		}
	}
	return node, nil
}
