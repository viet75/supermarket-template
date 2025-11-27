'use client'
import { useEffect } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

type ToastProps = {
    message: string
    onClose: () => void
}

export default function Toast({ message, onClose }: ToastProps) {
    useEffect(() => {
        const t = setTimeout(onClose, 2000) // auto-hide dopo 2s
        return () => clearTimeout(t)
    }, [onClose])

    return (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-2 bg-green-600 text-white text-sm px-4 py-2 rounded-full shadow-lg animate-fade-in-up">
                <CheckCircleIcon className="w-5 h-5 text-white" />
                <span>{message}</span>
            </div>
        </div>
    )
}
