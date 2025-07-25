# RofelloDS MTG Search SPA

A Google-like single-page application for searching Magic: The Gathering cards using natural language queries.

## Repository Structure

This is the **frontend web application repository**. The complete system consists of two independent repositories in a unified workspace:

- **Frontend Web App**: `DarylSchroeder/rofellods-nlp-mtg` (this repository)
  - HTML/CSS/JavaScript web interface
  - User-friendly search interface with card display
  - Deployed at: https://rofellods-nlp-mtg.onrender.com

- **Backend API**: `DarylSchroeder/mtg-nlp-search` (sister repository at `../backend`)
  - FastAPI backend with `/search`, `/analyze-deck`, and `/health-check` endpoints
  - Natural language processing for MTG card queries
  - Deployed at: https://mtg-nlp-search.onrender.com

**Unified Workspace**: Both repositories are organized under `/root/code/mtg-nlp-app/` for unified development while maintaining independent git history and deployment.
  - Natural language processing for MTG card queries
  - Scryfall API integration
  - Provides API endpoints consumed by this frontend

## Features

- **Google-inspired design** with clean, modern interface
- **Natural language search** powered by MTG NLP Search API
- **Card results** displayed as rows with images, details, and TCGPlayer links
- **Responsive design** that works on desktop and mobile
- **RofelloDS branding** with integrated logo

## Search Examples

- `"1 mana counterspell"`
- `"blue counterspell that can go in a chulane deck"`
- `"azorius removal"`
- `"fetchland"`
- `"3 mana simic creature"`

## File Structure

```
rofellods-nlp-mtg/
├── index.html          # Main HTML structure
├── styles.css          # CSS styling (Google-like design)
├── script.js           # JavaScript functionality
└── README.md           # This file
```

## Deployment

### Option 1: Static Hosting (Recommended)
Upload all files to any static hosting service:
- **Netlify**: Drag & drop the folder
- **Vercel**: Connect to Git repository
- **GitHub Pages**: Push to repository with Pages enabled
- **Your existing website**: Upload to subdirectory

### Option 2: Local Development
1. Open `index.html` in a web browser
2. Or serve with a local server:
   ```bash
   python -m http.server 8080
   # Then visit http://localhost:8080
   ```

## Integration with www.rofellods.com

To integrate with your existing website:

1. **Upload files** to a subdirectory like `/mtg-search/`
2. **Add navigation link** from your main site
3. **Customize branding** by modifying the CSS colors/fonts to match your site
4. **Update logo path** if needed (currently uses external Wix URL)

## API Integration

The app connects to the MTG NLP Search API at:
`https://mtg-nlp-search.onrender.com/search`

No API keys or configuration required.

## Customization

### Colors & Branding
Edit `styles.css` to match your brand colors:
```css
/* Primary blue color */
.card-name { color: #1a73e8; }
.tcg-link { background-color: #1a73e8; }

/* Update to your brand color */
.card-name { color: #your-brand-color; }
```

### Logo
The logo is currently loaded from:
```
https://static.wixstatic.com/media/e4ada0_cd8c288a3fd94904afa503d34b44eed0~mv2.png
```

To use a local logo, download the image and update the `src` in `index.html`.

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 13+
- Mobile browsers

## Performance

- **Fast loading** with minimal dependencies
- **Lazy image loading** for card images
- **Responsive design** optimized for all devices
- **Clean code** with modern JavaScript (ES6+)
