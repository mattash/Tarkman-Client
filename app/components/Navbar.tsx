// app/components/Navbar.tsx
import { Link } from '@tanstack/react-router'
import { AuthLink } from './AuthLink'
import { useState } from 'react'

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const navLinkClassName =
    'px-3 py-2 rounded-md text-sm font-medium bg-transparent hover:bg-tarkman-purple-light hover:text-white transition-colors'
  const activeNavLinkClassName = 'font-bold underline underline-offset-4 text-white'
  const mobileNavLinkClassName =
    'block px-3 py-2 rounded-md text-base font-medium bg-transparent hover:bg-tarkman-purple-light hover:text-white transition-colors'

  return (
    <header className="bg-tarkman-purple text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo and Desktop Navigation */}
          <div className="flex items-center pl-2">
            <div className="flex-shrink-0">
              <img src="/apple-touch-icon.png" alt="Tarkman Logo" className="h-8 w-8 rounded-sm" />
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link 
                  to="/" 
                  className={navLinkClassName}
                  activeProps={{ className: activeNavLinkClassName }}
                >
                  Services
                </Link>
                <Link 
                  to="/about" 
                  className={navLinkClassName}
                  activeProps={{ className: activeNavLinkClassName }}
                >
                  About
                </Link>
              </div>
            </div>
          </div>

          {/* Auth Link - Desktop */}
          <div className="hidden md:block">
            <AuthLink />
          </div>

          {/* Mobile menu button */}
          <div className="pr-2 md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger icon */}
              {!isMenuOpen ? (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link
              to="/"
              className={mobileNavLinkClassName}
              activeProps={{ className: activeNavLinkClassName }}
              onClick={() => setIsMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              to="/about"
              className={mobileNavLinkClassName}
              activeProps={{ className: activeNavLinkClassName }}
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <div className="px-3 py-2">
              <AuthLink />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
