# Changelog

All notable changes to the Crowdia app are documented in this file.

## [0.2.1] - 2025-12-04

### Added
- Automated deployments via EAS workflows on push to main

## [0.2.0] - 2025-12-04

### Added
- Points card on home screen showing total points and breakdown of earned points
- Display name shown on profile card and welcome message
- Cross-platform session persistence using localStorage (web) and expo-secure-store (native)

### Changed
- Home screen header now shows "Crowdia" instead of "(tabs)"
- Removed parallax hero header from home screen
- Welcome message now shows user's display name if available
- Simplified root layout by removing conditional Stack.Screen rendering

### Fixed
- Fixed duplicate header bars issue on home screen
- Fixed 406 errors on login caused by RLS policy blocking organizer profile view
- Fixed session not persisting across page refreshes
- Fixed SSR/Node.js error with localStorage detection

### Removed
- Removed "Current Features" and "App Status" cards from home screen
- Removed points display from profile card (moved to dedicated Points card)

## [0.1.0] - 2025-12-02

### Added
- Complete authentication system with Supabase integration
- User signup and login with email/password
- User profiles with points system
- Organizer registration and verification flow
- Session management with auto-refresh tokens
- Points awarded for signup (10), email confirmation (50), and profile completion (25)
- Email confirmation status display
- Organizer profile display for verified organizers

## [0.0.3] - 2025-11-13

### Added
- Complete database setup and verification
- Supabase project configuration
- Database schema with users, organizers, events tables
- Row Level Security (RLS) policies
- Environment variable configuration

### Changed
- Added .env to gitignore for security

## [0.0.2] - 2025-11-06

### Added
- EAS (Expo Application Services) configuration
- GitHub Actions workflow for web deployment
- iOS build settings in app configuration
- expo-dev-client for development builds
- MVP development tasks documentation

## [0.0.1] - 2025-10-26

### Added
- Initial Expo project setup
- Basic tab navigation structure
- Themed components for light/dark mode
