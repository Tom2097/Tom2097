"use client"

import { useState, useRef, useEffect } from "react"
import { Camera, Check, Loader2, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"


interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void
  onCancel: () => void
  isLoading?: boolean
}

export function CameraCapture({ onCapture, onCancel, isLoading }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [livenessCheck, setLivenessCheck] = useState<"none" | "blink" | "smile">("none")
  const [livenessPassed, setLivenessPassed] = useState(false)

  // Start camera
  useEffect(() => {
    let stream: MediaStream | null = null
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 1280, height: 720 },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setStream(stream)
        }
      } catch {
        setError("Could not access camera. Please enable camera permissions.")
      }
    }
    startCamera()
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Liveness detection (simplified)
  useEffect(() => {
    if (livenessCheck === "none") return
    const timer = setTimeout(() => {
      setLivenessPassed(true)
    }, 3000) // Simulate liveness check
    return () => clearTimeout(timer)
  }, [livenessCheck])

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageDataUrl = canvas.toDataURL("image/jpeg")
      setCapturedImage(imageDataUrl)
    }
  }

  const retakeImage = () => {
    setCapturedImage(null)
    setLivenessCheck("none")
    setLivenessPassed(false)
  }

  const confirmImage = () => {
    if (capturedImage) {
      onCapture(capturedImage)
    }
  }

  const triggerLivenessCheck = () => {
    setLivenessCheck(livenessCheck === "blink" ? "smile" : "blink")
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6 space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold">Identity Verification</h3>
          <p className="text-sm text-muted-foreground">
            Capture a live photo to verify your identity
          </p>
        </div>

        <div className="relative aspect-video bg-black/10 rounded-lg overflow-hidden">
          {!capturedImage ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <p className="text-white text-sm">{error}</p>
                </div>
              )}
            </>
          ) : (
            <img
              src={capturedImage}
              alt="Captured selfie"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {error && !capturedImage && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {!capturedImage ? (
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
            <Button
              onClick={captureImage}
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              <Camera className="w-4 h-4 mr-2" /> Capture
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!livenessPassed ? (
              <div className="text-center">
                <p className="text-sm font-medium mb-2">Liveness Check</p>
                <p className="text-sm text-muted-foreground mb-4">
                    Please {livenessCheck === "blink" ? "blink" : "smile"} to confirm you&apos;re a real person
                  </p>
                <Button
                  onClick={triggerLivenessCheck}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 mr-2" />
                  )}
                  {livenessCheck === "blink" ? "I Blinked" : "I Smiled"}
                </Button>
              </div>
            ) : (
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={retakeImage}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Retake
                </Button>
                <Button
                  onClick={confirmImage}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  <Check className="w-4 h-4 mr-2" /> Confirm
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}