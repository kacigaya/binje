<p align="center">
  <img src="app/icon.svg" alt="Logo" width="200">
</p>

<h1 align="center">b!nje</h1>

<p align="center">
   <strong>A modern movie and TV show discovery web application built with Next.js.</strong><br>
   <em>Powered by [TMDB API](https://www.themoviedb.org/documentation/api).</em>
</p>

## Features

- Browse trending and popular movies & TV shows
- Search functionality for finding content
- Detailed movie and TV show pages
- Hero section with featured content
- Carousel components for browsing media
- Responsive design with Tailwind CSS

## Tech Stack

- **Framework:** Next.js 16
- **UI:** React 19, Tailwind CSS 4
- **Components:** shadcn/ui, base-ui, Lucide icons
- **Styling:** class-variance-authority, clsx, tailwind-merge
- **Language:** TypeScript

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- A TMDB API key (set in `.env.local`)

### Installation

```bash
bun install
# or
npm install
```

### Development

```bash
bun dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Project Structure

```
app/            # Next.js App Router pages and layouts
components/     # Reusable UI components
lib/            # Utilities and TMDB API client
types/          # TypeScript type definitions
public/         # Static assets
```
