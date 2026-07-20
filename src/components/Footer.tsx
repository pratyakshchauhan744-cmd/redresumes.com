import { Link } from 'react-router-dom';
import type { AuthUser } from '../lib/backendApi';

export const Footer = ({ currentUser }: { currentUser: AuthUser | null }) => (
  <footer className="border-t border-zinc-100 bg-white">
    <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-10 text-sm">
      <div>
        <p className="text-lg font-bold text-zinc-900">RedResumes</p>
        <p className="text-zinc-500 mt-2">Build resumes that are clear, ATS-friendly, and recruiter-ready.</p>
      </div>
      <div className="space-y-2 flex flex-col items-start">
        <p className="text-zinc-900 font-semibold mb-1">Product</p>
        <Link to="/builder" className="block text-zinc-500 hover:text-zinc-900">Resume Builder</Link>
        <Link to="/job-finder" className="block text-zinc-500 hover:text-zinc-900">Job Finder</Link>
        <Link to="/cover-letter" className="block text-zinc-500 hover:text-zinc-900">Cover Letter Builder</Link>
        <Link to="/templates" className="block text-zinc-500 hover:text-zinc-900">Templates</Link>
      </div>
      <div className="space-y-2 flex flex-col items-start">
        <p className="text-zinc-900 font-semibold mb-1">Company</p>
        <Link to="/about" className="block text-zinc-500 hover:text-zinc-900">About Us</Link>
        <Link to="/blog" className="block text-zinc-500 hover:text-zinc-900">Blog</Link>
        <Link to="/examples" className="block text-zinc-500 hover:text-zinc-900">Resume Examples</Link>
        <Link to="/contact" className="block text-zinc-500 hover:text-zinc-900">Contact</Link>
        <Link to="/dashboard" className="block text-zinc-500 hover:text-zinc-900">Dashboard</Link>
      </div>
      <div className="space-y-2 flex flex-col items-start">
        <p className="text-zinc-900 font-semibold mb-1">Legal</p>
        <Link to="/privacy" className="block text-zinc-500 hover:text-zinc-900">Privacy Policy</Link>
        <Link to="/terms" className="block text-zinc-500 hover:text-zinc-900">Terms of Service</Link>
        {currentUser?.role === 'admin' && (
          <Link to="/admin" className="block text-zinc-500 hover:text-zinc-900">Admin Panel</Link>
        )}
      </div>
    </div>
    <div className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-400">
      &copy; {new Date().getFullYear()} RedResumes.com
    </div>
  </footer>
);
