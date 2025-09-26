# 🚀 LoomLance Dashboard

> Loomlance is the all-in-one dashboard built for freelancers who are tired of juggling too many tools. Instead of switching between invoicing apps, contract platforms, task boards, and client emails, Loomlance weaves everything into a single, clean workspace.

## ✨ Features

- 📊 **Unified Dashboard** - See all your business metrics in one place
- 📄 **Smart Invoicing** - Create, send, and track invoices without switching apps
- 📋 **Contract Management** - Handle agreements and legal documents seamlessly
- 👥 **Client Hub** - Organize all client information and communication
- 👤 **Profile Management** - Maintain your professional freelancer profile
- 🌙 **Dark/Light Mode** - Beautiful themes that adapt to your workflow
- 📱 **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- 🔄 **No More Tool Switching** - Everything you need in one clean workspace

## 🚀 Live Demo

Visit: [https://loomlance.com](https://loomlance.com)

## 🎯 The Problem We Solve

As a freelancer, you're probably using:
- ❌ One app for invoicing
- ❌ Another for contracts  
- ❌ A separate tool for client management
- ❌ Different platforms for task tracking
- ❌ Email scattered across multiple clients

**LoomLance eliminates the chaos** by weaving all these tools into one unified workspace.

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router DOM
- **State Management**: React Context API
- **Deployment**: AWS Amplify

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/loomlance-dashboard.git
   cd loomlance-dashboard
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
```bash
npm run dev          # Start development server
```
Open your browser to `http://localhost:3000` (or the port shown in your terminal).

### Build & Lint
```bash
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run build:prod   # Production build with optimizations
```

## 🎨 Design System

### Brand Colors
- **Primary**: #2D3E50 (Deep Blue) - Trust and professionalism
- **Accent**: #F39C12 (Action Orange) - Energy and action
- **Neutral Dark**: #7F8C8D - Secondary text and subtle elements
- **Neutral Light**: #BDC3C7 - Borders and dividers

### Typography
- **Font**: Inter (system-ui fallback) - Clean, modern, highly readable
- **Weights**: 400, 500, 600, 700 - Perfect hierarchy for business content

## 🚀 Deployment

### AWS Amplify (Recommended)
1. Connect your GitHub repository to AWS Amplify
2. Configure build settings (amplify.yml is provided)
3. Add custom domain (loomlance.com)
4. SSL certificate is automatically provisioned

## 📁 Project Structure

```
loomlance-dashboard/
├── public/
│   └── logo.png           # Project logo
├── src/
│   ├── assets/            # Static assets (images, etc.)
│   ├── components/        # Reusable UI components
│   ├── context/           # React Context for global state
│   ├── pages/             # Page-level components (views)
│   ├── styles/            # Tailwind CSS configuration and theme system
│   ├── App.jsx            # Main application component
│   └── main.jsx           # Entry point for React app
├── .gitignore             # Specifies intentionally untracked files
├── package.json           # Project dependencies and scripts
├── tailwind.config.js     # Tailwind CSS configuration
├── vite.config.js         # Vite build configuration
├── amplify.yml            # AWS Amplify configuration
├── deploy-aws.md          # AWS deployment guide
└── README.md              # Project documentation
```

## 🎯 Who This Is For

- **Freelancers** tired of juggling multiple tools
- **Consultants** who need streamlined client management
- **Agencies** looking for unified project oversight
- **Solo entrepreneurs** wanting to scale efficiently
- **Remote workers** who need organized workflows

## 🤝 Contributing

We welcome contributions from the freelancer community! 

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ for freelancers who deserve better tools
- Icons by [Lucide](https://lucide.dev/) - Beautiful, consistent iconography
- Styling with [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- Deployed on [AWS Amplify](https://aws.amazon.com/amplify/) - Reliable, scalable hosting

---

**Ready to stop juggling tools?** [Try LoomLance today](https://loomlance.com) and experience the power of a unified freelancer workspace.
