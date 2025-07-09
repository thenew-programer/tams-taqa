import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, MessageCircle, Zap } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import { supabaseChatService } from '../../services/supabaseChatService';
import { useChatLogging } from '../../hooks/useLogging';
import { toast } from 'react-hot-toast';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export const ChatInterface: React.FC = () => {
  const { logMessageSent, logAIResponse, logError } = useChatLogging();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'bot',
      content: 'Bonjour! Je suis votre assistant IA TAMS. Comment puis-je vous aider aujourd\'hui?',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Suggested messages for quick access
  const suggestedMessages = [
    "Afficher les anomalies critiques",
    "État des équipements P-101",
    "Planning de maintenance",
    "Statistiques des anomalies"
  ];

  // Scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load initial connection
  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSuggestedMessage = (suggestion: string) => {
    setInputMessage(suggestion);
    // Auto-send the suggested message after a brief delay
    setTimeout(() => {
      if (!isTyping) {
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          type: 'user',
          content: suggestion,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsTyping(true);
        
        // Process the message
        processMessage(suggestion);
      }
    }, 100);
  };

  const processMessage = async (message: string) => {
    const startTime = Date.now();
    
    try {
      // Log the user message
      await logMessageSent(message, message.length);
      
      // Get AI response from Supabase service
      const context = await buildMessageContext(message);
      const response = await supabaseChatService.getAIResponse(message, context);
      
      const botResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: response,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, botResponse]);
      
      // Save conversation to database
      await supabaseChatService.saveChatMessage(message, response, context);
      
      // Log the AI response
      const duration = Date.now() - startTime;
      await logAIResponse(response.length, duration);
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Log the error
      await logError(error as Error, 'chat-message-processing');
      
      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'Désolé, je rencontre une difficulté pour traiter votre demande. Veuillez réessayer.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorResponse]);
      toast.error('Erreur lors du traitement de votre message');
    } finally {
      setIsTyping(false);
    }
  };

  const loadInitialData = async () => {
    try {
      // Test connection to Supabase
      const { error: anomaliesError } = await supabase
        .from('anomalies')
        .select('id')
        .limit(1);
        
      if (anomaliesError) throw anomaliesError;
      
      toast.success('Connecté à la base de données');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      toast.error('Erreur de connexion à la base de données');
    }
  };
  
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    const currentMessage = inputMessage;
    setInputMessage('');
    setIsTyping(true);
    
    // Process the message
    await processMessage(currentMessage);
  };

  const buildMessageContext = async (message: string) => {
    const lowerMessage = message.toLowerCase();
    const context: any = {};

    try {
      // Get basic data based on message content (fallback for non-vector search)
      if (lowerMessage.includes('anomalie') || lowerMessage.includes('critique') || lowerMessage.includes('équipement')) {
        const { data: anomalies, error } = await supabase
          .from('anomalies')
          .select('*')
          .limit(3);
          
        if (!error && anomalies) {
          context.anomalies = anomalies;
        }
      }

      if (lowerMessage.includes('maintenance') || lowerMessage.includes('planning') || lowerMessage.includes('arrêt')) {
        const { data: maintenanceWindows, error } = await supabase
          .from('maintenance_windows')
          .select('*')
          .limit(3);
          
        if (!error && maintenanceWindows) {
          context.maintenanceWindows = maintenanceWindows;
        }
      }

      // Calculate basic statistics
      const { data: anomalies, error: anomaliesError } = await supabase
        .from('anomalies')
        .select('status, final_criticality_level')
        .limit(1000);
        
      if (!anomaliesError && anomalies) {
        const openAnomalies = anomalies.filter(a => a.status !== 'cloture').length;
        const criticalAnomalies = anomalies.filter(a => a.final_criticality_level >= 10).length;
        const totalAnomalies = anomalies.length;
        const treatmentRate = totalAnomalies > 0 ? Math.round(((totalAnomalies - openAnomalies) / totalAnomalies) * 100) : 0;
        
        context.statistics = {
          openAnomalies,
          criticalAnomalies,
          treatmentRate,
          averageResolutionTime: 5
        };
      }

    } catch (error) {
      console.error('Error building context:', error);
    }

    return context;
  };
  
  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Assistant IA TAMS</h1>
                <p className="text-sm text-gray-500 flex items-center">
                  <Sparkles className="h-4 w-4 mr-1 text-purple-500" />
                  Alimenté par l'IA • En ligne
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
              <MessageCircle className="h-4 w-4" />
              <span>{messages.length} messages</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex items-start space-x-4 animate-fadeIn ${
                  message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                  message.type === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                    : 'bg-gradient-to-br from-purple-500 to-purple-600'
                }`}>
                  {message.type === 'user' ? (
                    <User className="h-5 w-5 text-white" />
                  ) : (
                    <Bot className="h-5 w-5 text-white" />
                  )}
                </div>
                
                {/* Message Bubble */}
                <div className={`group max-w-xs sm:max-w-md lg:max-w-lg ${message.type === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`relative px-5 py-3 rounded-2xl shadow-sm transition-all duration-200 group-hover:shadow-md ${
                      message.type === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    
                    {/* Message Time */}
                    <div className={`text-xs mt-2 opacity-70 ${
                      message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString('fr-FR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-start space-x-4 animate-fadeIn">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="bg-white px-5 py-3 rounded-2xl rounded-bl-md border border-gray-200 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                    <span className="text-xs text-gray-500 ml-2">Assistant IA tape...</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Show suggested messages only when there are few messages */}
            {messages.length <= 2 && !isTyping && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 font-medium">Suggestions:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {suggestedMessages.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedMessage(suggestion)}
                      className="text-left p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-sm text-gray-700 group"
                    >
                      <div className="flex items-center justify-between">
                        <span>{suggestion}</span>
                        <Zap className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
      
      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Input
                placeholder="Tapez votre message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                disabled={isTyping}
                className="w-full px-4 py-3 pr-16 bg-gray-50 border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 placeholder-gray-500"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputMessage.trim() || isTyping}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-10 w-10 p-0 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-gray-400 mt-2 text-center">
            L'IA peut faire des erreurs. Vérifiez les informations importantes.
          </p>
        </div>
      </div>
    </div>
  );
};