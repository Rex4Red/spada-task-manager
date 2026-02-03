import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
    const { user } = useAuth();
    const [settings, setSettings] = useState(null);
    const [telegramChatId, setTelegramChatId] = useState('');
    const [telegramBotToken, setTelegramBotToken] = useState('');
    const [isTelegramActive, setIsTelegramActive] = useState(true);

    // Discord State
    const [discordWebhook, setDiscordWebhook] = useState('');
    const [isDiscordActive, setIsDiscordActive] = useState(true);
    const [savingDiscord, setSavingDiscord] = useState(false);
    const [testingDiscord, setTestingDiscord] = useState(false);

    // SPADA State
    const [spadaUsername, setSpadaUsername] = useState('');
    const [spadaPassword, setSpadaPassword] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingSpada, setSavingSpada] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/settings');
            const data = response.data.data;
            setSettings(data);
            if (data.telegramConfig) {
                setTelegramChatId(data.telegramConfig.chatId || '');
                setTelegramBotToken(data.telegramConfig.botToken || '');
                setIsTelegramActive(data.telegramConfig.isActive);
            }
            // Pre-fill SPADA username if exists
            if (data.spadaUsername) {
                setSpadaUsername(data.spadaUsername);
                setSpadaPassword('');
            }
            // Pre-fill Discord webhook if exists
            if (data.discordConfig) {
                setDiscordWebhook(data.discordConfig.webhookUrl || '');
                setIsDiscordActive(data.discordConfig.isActive);
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSpada = async () => {
        if (!spadaUsername || !spadaPassword) {
            alert('Please enter both username and password.');
            return;
        }
        setSavingSpada(true);
        try {
            await api.put('/settings/spada', {
                username: spadaUsername,
                password: spadaPassword
            });
            alert('SPADA credentials saved successfully!');
            setSpadaPassword(''); // Clear password field
        } catch (error) {
            console.error('Failed to save SPADA settings:', error);
            alert('Failed to save SPADA settings.');
        } finally {
            setSavingSpada(false);
        }
    };

    const handleSaveTelegram = async () => {
        setSaving(true);
        try {
            await api.put('/settings/telegram', {
                chatId: telegramChatId,
                botToken: telegramBotToken,
                isActive: isTelegramActive
            });
            alert('Settings saved successfully!');
            fetchSettings();
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleTestNotification = async () => {
        setTesting(true);
        try {
            await api.post('/settings/telegram/test', {
                chatId: telegramChatId,
                botToken: telegramBotToken
            });
            alert('Test notification sent! Check your Telegram.');
        } catch (error) {
            console.error('Test failed:', error);
            const msg = error.response?.data?.message || 'Failed to send test notification. Ensure Bot Token and Chat ID are correct.';
            alert(msg);
        } finally {
            setTesting(false);
        }
    };

    const handleSaveDiscord = async () => {
        if (!discordWebhook) {
            alert('Please enter a Discord Webhook URL.');
            return;
        }
        setSavingDiscord(true);
        try {
            await api.put('/settings/discord', {
                webhookUrl: discordWebhook,
                isActive: isDiscordActive
            });
            alert('Discord settings saved!');
            fetchSettings();
        } catch (error) {
            console.error('Failed to save Discord settings:', error);
            alert('Failed to save Discord settings.');
        } finally {
            setSavingDiscord(false);
        }
    };

    const handleTestDiscord = async () => {
        setTestingDiscord(true);
        try {
            await api.post('/settings/discord/test', {
                webhookUrl: discordWebhook
            });
            alert('Test notification sent to Discord!');
        } catch (error) {
            console.error('Discord test failed:', error);
            const msg = error.response?.data?.message || 'Failed to send Discord test notification.';
            alert(msg);
        } finally {
            setTestingDiscord(false);
        }
    };

    return (
        <Layout>
            <div className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-8 py-6 flex flex-col gap-8">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em]">Settings</h1>
                    <p className="text-[#9dabb9] text-base font-normal leading-normal">Manage your account preferences and integrations.</p>
                </div>

                {/* Account Info */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-white text-xl font-bold">Account</h2>
                    <div className="bg-card-dark rounded-xl border border-[#283039] p-6 flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-1">
                                <label className="text-[#9dabb9] text-xs uppercase font-medium tracking-wider">Name</label>
                                <p className="text-white text-lg font-medium">{settings?.name || user?.name}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[#9dabb9] text-xs uppercase font-medium tracking-wider">Email</label>
                                <p className="text-white text-lg font-medium">{settings?.email || user?.email}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SPADA Credentials */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">school</span>
                        <h2 className="text-white text-xl font-bold">SPADA Credentials</h2>
                    </div>
                    <div className="bg-card-dark rounded-xl border border-[#283039] p-6 flex flex-col gap-6">
                        <p className="text-[#9dabb9] text-sm">
                            Save your SPADA UPN Yogyakarta credentials here to enable <b>Automatic Sync</b>.
                            <br />
                            Your password is encrypted and stored securely.
                        </p>

                        <div className="flex flex-col gap-4 max-w-xl">
                            <div className="flex flex-col gap-2">
                                <label className="text-white text-sm font-medium">SPADA Username / NIM</label>
                                <input
                                    type="text"
                                    value={spadaUsername}
                                    onChange={(e) => setSpadaUsername(e.target.value)}
                                    placeholder="e.g. 123456789"
                                    className="bg-[#101922] border border-[#3b4754] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-white text-sm font-medium">SPADA Password</label>
                                <input
                                    type="password"
                                    value={spadaPassword}
                                    onChange={(e) => setSpadaPassword(e.target.value)}
                                    placeholder="Enter your SPADA password"
                                    className="bg-[#101922] border border-[#3b4754] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <button
                                    onClick={handleSaveSpada}
                                    disabled={savingSpada}
                                    className="px-6 py-2.5 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg transition-colors disabled:opacity-70"
                                >
                                    {savingSpada ? 'Saving...' : 'Save Credentials'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Telegram Integration */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">send</span>
                        <h2 className="text-white text-xl font-bold">Telegram Notifications</h2>
                    </div>

                    <div className="bg-card-dark rounded-xl border border-[#283039] p-6 flex flex-col gap-6">
                        <p className="text-[#9dabb9] text-sm">
                            Get notified about upcoming deadlines directly to your Telegram.
                            <br />
                            1. Create a bot using @BotFather and get the <b>Bot Token</b>.
                            <br />
                            2. Start your bot.
                            <br />
                            3. Enter your <b>Bot Token</b> and <b>Chat ID</b> below.
                        </p>

                        <div className="flex flex-col gap-4 max-w-xl">
                            <div className="flex items-center justify-between">
                                <label className="text-white text-sm font-medium">Telegram Bot Token (Optional if using global bot)</label>
                                <button
                                    onClick={() => setShowHelp(true)}
                                    className="text-primary text-xs font-medium hover:underline flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-[14px]">help</span>
                                    How to get this?
                                </button>
                            </div>
                            <div className="flex flex-col gap-2">
                                <input
                                    type="text"
                                    value={telegramBotToken}
                                    onChange={(e) => setTelegramBotToken(e.target.value)}
                                    placeholder="e.g. 123456789:ABCdefGHIjklMNOpqrSTUvwxyz"
                                    className="bg-[#101922] border border-[#3b4754] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                />
                                <p className="text-xs text-[#5e6a75]">Leave blank to use the system default bot.</p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-white text-sm font-medium">Telegram Chat ID</label>
                                <input
                                    type="text"
                                    value={telegramChatId}
                                    onChange={(e) => setTelegramChatId(e.target.value)}
                                    placeholder="e.g. 123456789"
                                    className="bg-[#101922] border border-[#3b4754] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsTelegramActive(!isTelegramActive)}
                                    className={`w-12 h-6 rounded-full relative transition-colors ${isTelegramActive ? 'bg-primary' : 'bg-[#283039]'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isTelegramActive ? 'left-7' : 'left-1'}`}></div>
                                </button>
                                <span className="text-white text-sm">Enable Notifications</span>
                            </div>

                            <div className="flex items-center gap-3 mt-2">
                                <button
                                    onClick={handleSaveTelegram}
                                    disabled={saving}
                                    className="px-6 py-2.5 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-70"
                                >
                                    {saving ? 'Saving...' : 'Save Settings'}
                                </button>
                                <button
                                    onClick={handleTestNotification}
                                    disabled={testing || !telegramChatId}
                                    className="px-6 py-2.5 bg-[#283039] text-white font-medium rounded-lg hover:bg-[#323b46] border border-[#3b4754] transition-colors disabled:opacity-50"
                                >
                                    {testing ? 'Sending...' : 'Test Notification'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Discord Integration */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                        <h2 className="text-white text-xl font-bold">Discord Notifications</h2>
                    </div>

                    <div className="bg-card-dark rounded-xl border border-[#283039] p-6 flex flex-col gap-6">
                        <p className="text-[#9dabb9] text-sm">
                            Get notified about upcoming deadlines directly to your Discord server or DM.
                            <br />
                            1. Go to your Discord server/channel settings → Integrations → Webhooks.
                            <br />
                            2. Create a new webhook and copy the <b>Webhook URL</b>.
                        </p>

                        <div className="flex flex-col gap-4 max-w-xl">
                            <div className="flex flex-col gap-2">
                                <label className="text-white text-sm font-medium">Discord Webhook URL</label>
                                <input
                                    type="text"
                                    value={discordWebhook}
                                    onChange={(e) => setDiscordWebhook(e.target.value)}
                                    placeholder="https://discord.com/api/webhooks/..."
                                    className="bg-[#101922] border border-[#3b4754] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#5865F2] transition-colors"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsDiscordActive(!isDiscordActive)}
                                    className={`w-12 h-6 rounded-full relative transition-colors ${isDiscordActive ? 'bg-[#5865F2]' : 'bg-[#283039]'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isDiscordActive ? 'left-7' : 'left-1'}`}></div>
                                </button>
                                <span className="text-white text-sm">Enable Discord Notifications</span>
                            </div>

                            <div className="flex items-center gap-3 mt-2">
                                <button
                                    onClick={handleSaveDiscord}
                                    disabled={savingDiscord}
                                    className="px-6 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-lg transition-colors disabled:opacity-70"
                                >
                                    {savingDiscord ? 'Saving...' : 'Save Discord'}
                                </button>
                                <button
                                    onClick={handleTestDiscord}
                                    disabled={testingDiscord || !discordWebhook}
                                    className="px-6 py-2.5 bg-[#283039] text-white font-medium rounded-lg hover:bg-[#323b46] border border-[#3b4754] transition-colors disabled:opacity-50"
                                >
                                    {testingDiscord ? 'Sending...' : 'Test Discord'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Help Modal */}
            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1c252e] border border-[#3b4754] rounded-xl w-full max-w-lg p-6 flex flex-col gap-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowHelp(false)}
                            className="absolute top-4 right-4 text-[#9dabb9] hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>

                        <h3 className="text-white text-xl font-bold">How to get Telegram Credentials</h3>

                        <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh] pr-2">
                            {/* Video Tutorial */}
                            <div className="flex flex-col gap-2">
                                <h4 className="text-primary font-bold text-sm uppercase tracking-wider">Video Tutorial</h4>
                                <div className="relative w-full pt-[56.25%] rounded-lg overflow-hidden border border-[#3b4754]">
                                    <iframe
                                        className="absolute top-0 left-0 w-full h-full"
                                        src="https://www.youtube.com/embed/4uLoLyaA85I"
                                        title="Telegram Credentials Tutorial"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            </div>

                            <div className="h-px bg-[#3b4754] w-full"></div>

                            {/* Step 1 */}
                            <div className="flex flex-col gap-2">
                                <h4 className="text-primary font-bold text-sm uppercase tracking-wider">1. Get Bot Token</h4>
                                <ol className="list-decimal list-inside text-[#cdd7e1] text-sm space-y-1 ml-1">
                                    <li>Open Telegram and search for <b>@BotFather</b>.</li>
                                    <li>Send the command <code>/newbot</code>.</li>
                                    <li>Follow the instructions to name your bot.</li>
                                    <li>Copy the <b>HTTP API Token</b> provided.</li>
                                </ol>
                            </div>

                            <div className="h-px bg-[#3b4754] w-full"></div>

                            {/* Step 2 */}
                            <div className="flex flex-col gap-2">
                                <h4 className="text-primary font-bold text-sm uppercase tracking-wider">2. Get Chat ID</h4>
                                <ol className="list-decimal list-inside text-[#cdd7e1] text-sm space-y-1 ml-1">
                                    <li>Search for <b>@userinfobot</b> (or any ID bot).</li>
                                    <li>Click <b>Start</b>.</li>
                                    <li>Copy your <b>Id</b> (it's a number like 123456789).</li>
                                </ol>
                            </div>

                            <div className="h-px bg-[#3b4754] w-full"></div>

                            {/* Step 3 */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                <p className="text-blue-200 text-sm">
                                    <b>Important:</b> Before testing, search for <b>your own bot username</b> (that you created in step 1) and click <b>START</b> so it can message you!
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowHelp(false)}
                            className="w-full py-2.5 bg-[#283039] hover:bg-[#323b46] text-white font-medium rounded-lg transition-colors"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Settings;
