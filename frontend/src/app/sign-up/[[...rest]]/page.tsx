import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-4">
            Join TourGuide AI
          </h1>
          <p className="text-gray-300">
            Start exploring the world with your personal AI guide
          </p>
        </div>
        
        <div className="glass rounded-2xl p-8 shadow-2xl">
          <SignUp 
            afterSignUpUrl="/voice"
            redirectUrl="/voice"
            appearance={{
              baseTheme: undefined,
              variables: {
                colorPrimary: '#3b82f6',
                colorBackground: 'transparent',
                colorInputBackground: 'rgba(255, 255, 255, 0.05)',
                colorInputText: '#ffffff',
                colorText: '#ffffff',
                colorTextSecondary: '#a1a1aa',
                borderRadius: '0.5rem',
              },
              elements: {
                card: {
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                },
                headerTitle: {
                  color: '#ffffff',
                },
                headerSubtitle: {
                  color: '#a1a1aa',
                },
                formButtonPrimary: {
                  backgroundColor: '#3b82f6',
                  '&:hover': {
                    backgroundColor: '#2563eb',
                  },
                },
                formFieldInput: {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  '&:focus': {
                    borderColor: '#3b82f6',
                    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}