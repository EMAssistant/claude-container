# Backend Integration Notes

## Serving Built Frontend Assets

The production build outputs to `frontend/dist/` directory.

### Express Static File Configuration

Add this to your Express backend (`backend/src/server.ts`):

```typescript
import express from 'express'
import path from 'path'

const app = express()

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../../frontend/dist')))

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
```

### Build Output Structure

```
frontend/dist/
├── index.html              # Entry HTML with hashed asset references
├── assets/
│   ├── index-[hash].js     # JavaScript bundle with code splitting
│   └── index-[hash].css    # CSS bundle with Tailwind utilities
└── vite.svg                # Static assets
```

### Docker Container Path

In the Docker container, the backend will be at `/app/backend` and frontend at `/app/frontend`.

Express should serve from `/app/frontend/dist/`:

```typescript
app.use(express.static('/app/frontend/dist'))
```

### Verification

Test that built assets are servable:

```bash
# Build frontend
cd frontend && npm run build

# Start a simple HTTP server to test
npx serve dist -p 3000
# Or use Python
python3 -m http.server 3000 --directory dist
```

Then open http://localhost:3000 - should see Claude Container app.
