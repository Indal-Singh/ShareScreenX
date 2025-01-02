
const Footer = () => {
    return (
        <footer className="bg-gray-400 text-white py-6">
            <div className="container mx-auto text-center">
                <p className="mb-4">Developed by Indal Singh</p>
                <a 
                    href="https://github.com/Indal-Singh/ShareScreenX" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-black hover:text-gray-600"
                >
                    GitHub Project Repo
                </a>
                <div className="mt-4">
                    <p>&copy; {new Date().getFullYear()} ShareScreenX. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;