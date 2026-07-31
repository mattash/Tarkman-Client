interface MessageProps {
  message: string
}

export function Message({ message }: MessageProps) {
  return (
    <div className="fixed inset-x-0 top-4 flex justify-center z-50 animate-fade-in px-4">
      <div className="w-[80%] bg-gray-800/95 text-white px-12 py-8 rounded-lg shadow-lg text-9xl font-medium text-center">
        {message}
      </div>
    </div>
  )
}
