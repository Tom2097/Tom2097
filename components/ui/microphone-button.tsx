"use client"

import { Button } from '@/components/ui/button'
import { Mic, MicOff } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

interface MicrophoneButtonProps {
  onTranscript: (transcript: string) => void
  className?: string
}

export function MicrophoneButton({ onTranscript, className }: MicrophoneButtonProps) {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      
      if (!SpeechRecognition) {
        setError('Speech recognition is not supported in your browser.')
        return
      }
      
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        onTranscript(transcript)
        setIsListening(false)
      }
      
      recognition.onerror = (event) => {
        setError(event.error)
        setIsListening(false)
      }
      
      recognition.onend = () => {
        if (isListening) {
          recognition.start()
        }
      }
      
      recognitionRef.current = recognition
    }
  }, [isListening])

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      recognitionRef.current?.start()
      setIsListening(true)
      setError(null)
    }
  }

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="icon"
        onClick={toggleListening}
        disabled={!!error}
        aria-label={isListening ? "Stop listening" : "Start listening"}
      >
        {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}