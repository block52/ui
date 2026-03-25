interface ShareOnXButtonProps {
    url: string;
    text?: string;
    hashtags?: string;
}

export function ShareOnXButton({ url, text = "Check out this poker hand on Block52!", hashtags = "Block52,Poker,OnChainPoker" }: ShareOnXButtonProps) {
    const intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`;

    return (
        <a
            href={intentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-900 text-white rounded-lg transition-colors text-sm border border-gray-700"
        >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
        </a>
    );
}
