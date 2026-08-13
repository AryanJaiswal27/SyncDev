import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, FlatList, SafeAreaView, Platform, StatusBar, TouchableOpacity, Switch, Modal, Button } from 'react-native';
import { Picker } from '@react-native-picker/picker';

// --- Type Definitions ---
interface DiffData {
  file: string;
  diff: string;
}

interface Message {
  id: string; // for FlatList keyExtractor
  sender: 'ai' | 'user';
  text: string;
  isDiff?: boolean;
  diffData?: DiffData;
  isStep?: boolean;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-msg',
      sender: 'ai',
      text: "Connected to SyncDev Daemon. What's our next task?",
      isDiff: false
    }
  ]);
  const wsRef = useRef<WebSocket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [input, setInput] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');
  
  const [models, setModels] = useState([{id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash'}]);
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');
  
  // Connection state & settings
  const defaultHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  const [hostIp, setHostIp] = useState(defaultHost);
  const [wsState, setWsState] = useState<'Connecting' | 'Connected' | 'Disconnected'>('Disconnected');
  const [showSettings, setShowSettings] = useState(false);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setWsState('Connecting');
    const wsUrl = `ws://${hostIp}:8080/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Mobile WS connected');
      setWsState('Connected');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'agent_step') {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.sender === 'ai' && last.isStep) {
              return [...prev.slice(0, -1), { id: Date.now().toString(), sender: 'ai', text: data.payload, isStep: true }];
            }
            return [...prev, { id: Date.now().toString(), sender: 'ai', text: data.payload, isStep: true }];
          });
        } else if (data.type === 'chat_response') {
          let parsedResponse;
          try {
            parsedResponse = JSON.parse(data.payload);
          } catch(e) { parsedResponse = null; }

          if (parsedResponse && parsedResponse.type === 'code_diff') {
             setMessages(prev => [...prev, { 
               id: Date.now().toString(),
               sender: 'ai', 
               text: "I proposed a change:",
               isDiff: true,
               diffData: parsedResponse
             }]);
          } else {
             setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: data.payload }]);
          }
        }
      } catch (err) {
        console.error('Error parsing WS message', err);
      }
    };

    ws.onerror = (e) => {
      console.log('WebSocket Error: ', e);
    };

    ws.onclose = () => {
      console.log('WebSocket Closed. Reconnecting in 5s...');
      setWsState('Disconnected');
      wsRef.current = null;
      
      // Auto-reconnect logic
      if (!reconnectTimeoutRef.current && !isOffline) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connectWebSocket();
        }, 5000);
      }
    };

    wsRef.current = ws;
  }, [hostIp, isOffline]);

  useEffect(() => {
    // Fetch models
    const apiUrl = `http://${hostIp}:3000/api/models`;
    fetch(apiUrl)
      .then(res => res.json())
      .then(data => {
        if (data.models && data.models.length > 0) {
          setModels(data.models);
          // Set to default or current if it exists
          const exists = data.models.some((m: any) => m.id === selectedModel);
          if (!exists) setSelectedModel(data.models[0].id);
        }
      })
      .catch(err => console.log('Could not fetch models', err));

    // Connect WS if online
    if (!isOffline) {
       connectWebSocket();
    } else if (wsRef.current) {
       wsRef.current.close();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [hostIp, isOffline, connectWebSocket]);

  const handleSend = () => {
    if (input.trim()) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: input.trim(), isDiff: false }]);
      
      if (isOffline && input.trim().startsWith('run')) {
         setTerminalOutput("[Sandbox WASI] Executing locally on phone CPU...\n[Sandbox WASI] Success! Output: Hello from offline engine.");
      } else if (!isOffline) {
         if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ 
              type: 'chat', 
              payload: input.trim(),
              model: selectedModel 
            }));
         } else {
            console.log('WebSocket not open. Cannot send message.');
         }
      }

      setInput('');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      item.sender === 'ai' ? styles.aiMessage : styles.userMessage,
      item.isStep ? { backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 0, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 4, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#4f8aff' } : {}
    ]}>
      {item.isStep && <Text style={{ color: '#50fa7b', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 }}>⚡ {item.text}</Text>}
      {!item.isStep && <Text style={styles.messageText}>{item.text}</Text>}
      
      {item.isDiff && item.diffData && (
        <View style={styles.diffViewer}>
          <View style={styles.diffHeader}>
            <Text style={styles.diffHeaderText}>{item.diffData.file}</Text>
          </View>
          <View style={styles.diffContent}>
            <Text style={styles.diffText}>{item.diffData.diff}</Text>
          </View>
          <View style={styles.diffActions}>
            <TouchableOpacity style={styles.btnApprove} onPress={() => alert('Change Written!')}>
              <Text style={styles.btnApproveText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnReject} onPress={() => alert('Rejected.')}>
              <Text style={styles.btnRejectText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Settings</Text>
            <Text style={styles.label}>Daemon IP / Hostname</Text>
            <TextInput 
              style={styles.modalInput} 
              value={hostIp}
              onChangeText={setHostIp}
              placeholder="e.g. 192.168.1.10"
              placeholderTextColor="#888"
            />
            <Button title="Save & Close" onPress={() => setShowSettings(false)} />
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SyncDev Mobile</Text>
          <Text style={[styles.wsStatus, { color: wsState === 'Connected' ? '#50fa7b' : wsState === 'Connecting' ? '#f1fa8c' : '#ff5555' }]}>
             {isOffline ? 'Offline Mode' : wsState}
          </Text>
        </View>
        <View style={styles.modelPickerContainer}>
          <Picker
            selectedValue={selectedModel}
            onValueChange={(itemValue) => setSelectedModel(itemValue)}
            style={styles.picker}
            dropdownIconColor="#fff"
          >
            {models.map(m => (
              <Picker.Item key={m.id} label={m.name} value={m.id} color="#000" />
            ))}
          </Picker>
        </View>
        
        <View style={{flexDirection: 'row', gap: 10, alignItems: 'center'}}>
           <TouchableOpacity onPress={() => setShowSettings(true)}>
              <Text style={{color: '#fff', fontSize: 18}}>⚙️</Text>
           </TouchableOpacity>
           
           <View style={styles.offlineToggle}>
              <Switch value={isOffline} onValueChange={setIsOffline} trackColor={{ false: '#444', true: '#4f8aff' }} />
           </View>
        </View>
      </View>

      <View style={styles.mainArea}>
        <View style={styles.chatArea}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 15 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.input} 
              placeholder="Ask SyncDev or type 'run script'..." 
              placeholderTextColor="#888"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
            />
          </View>
        </View>
        
        {/* WASI Sandbox Terminal View */}
        {isOffline && (
          <View style={styles.terminalContainer}>
            <Text style={styles.terminalHeader}>SANDBOX TERMINAL</Text>
            <Text style={styles.terminalOutput}>{terminalOutput || 'Sandbox ready. Type a run command above...'}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    padding: 15,
    backgroundColor: 'rgba(25, 25, 30, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 10
  },
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 1.2 },
  wsStatus: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  modelPickerContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    height: 30,
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 10,
    overflow: 'hidden'
  },
  picker: { color: '#e0e0e0', height: 30, width: '100%', transform: [{ scale: 0.8 }] },
  offlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mainArea: { flex: 1, flexDirection: 'column', backgroundColor: '#09090b' },
  chatArea: { flex: 1 },
  aiMessage: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16, borderRadius: 12, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  userMessage: {
    backgroundColor: 'rgba(79, 138, 255, 0.15)',
    padding: 16, borderRadius: 12, marginBottom: 12,
    alignSelf: 'flex-end', borderWidth: 1, borderColor: 'rgba(79, 138, 255, 0.3)',
    shadowColor: '#4f8aff', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  messageText: { color: '#f3f4f6', fontSize: 15, lineHeight: 22 },
  
  // Diff Viewer Styles
  diffViewer: {
    marginTop: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden'
  },
  diffHeader: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  diffHeaderText: { color: '#e0e0e0', fontSize: 12, fontWeight: 'bold' },
  diffContent: { padding: 10 },
  diffText: { color: '#a9b7c6', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  diffActions: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 10
  },
  btnApprove: {
    backgroundColor: 'rgba(79, 138, 255, 0.2)',
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(79, 138, 255, 0.2)'
  },
  btnApproveText: { color: '#4f8aff', fontWeight: 'bold', fontSize: 12 },
  btnReject: {
    backgroundColor: 'rgba(255, 79, 79, 0.1)',
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(255, 79, 79, 0.2)'
  },
  btnRejectText: { color: '#ff4f4f', fontWeight: 'bold', fontSize: 12 },

  inputContainer: {
    padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(25, 25, 30, 0.9)',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff',
    borderRadius: 24, paddingHorizontal: 20, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    fontSize: 15
  },

  // Terminal Styles
  terminalContainer: {
    height: 120,
    backgroundColor: '#050505',
    borderTopWidth: 1,
    borderTopColor: '#333',
    padding: 10
  },
  terminalHeader: { color: '#555', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  terminalOutput: { color: '#50fa7b', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333'
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  label: { color: '#aaa', fontSize: 12, marginBottom: 5 },
  modalInput: {
    backgroundColor: '#000',
    color: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#444',
    padding: 10,
    marginBottom: 20
  }
});
