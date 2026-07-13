import { Text } from "@tarojs/components";

type IconProps = {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  [key: string]: unknown;
};

function makeIcon(label: string) {
  return function Icon({ className = "", ...props }: IconProps) {
    return (
      <Text {...props} className={`ueat-icon ${className}`}>
        {label}
      </Text>
    );
  };
}

export const ArrowLeft = makeIcon("<");
export const ArrowRight = makeIcon(">");
export const AtSign = makeIcon("@");
export const BadgeCheck = makeIcon("✓");
export const Bell = makeIcon("!");
export const Bookmark = makeIcon("□");
export const Camera = makeIcon("▣");
export const Check = makeIcon("✓");
export const CheckCheck = makeIcon("✓✓");
export const ChevronDown = makeIcon("⌄");
export const ChevronRight = makeIcon(">");
export const ChevronUp = makeIcon("⌃");
export const CircleHelp = makeIcon("?");
export const CircleUserRound = makeIcon("人");
export const Clock3 = makeIcon("时");
export const EyeOff = makeIcon("隐");
export const Headphones = makeIcon("听");
export const Heart = makeIcon("♡");
export const Home = makeIcon("⌂");
export const Image = makeIcon("图");
export const Info = makeIcon("i");
export const Keyboard = makeIcon("⌨");
export const KeyRound = makeIcon("钥");
export const LockKeyhole = makeIcon("锁");
export const LogOut = makeIcon("出");
export const MapPin = makeIcon("位");
export const MessageCircle = makeIcon("聊");
export const MessageCircleWarning = makeIcon("!");
export const Mic = makeIcon("麦");
export const Moon = makeIcon("月");
export const MoreHorizontal = makeIcon("...");
export const PenLine = makeIcon("笔");
export const Phone = makeIcon("☎");
export const PhoneMissed = makeIcon("×");
export const PhoneOutgoing = makeIcon("↗");
export const Play = makeIcon("▶");
export const Plus = makeIcon("+");
export const QrCode = makeIcon("码");
export const RefreshCw = makeIcon("↻");
export const RotateCcw = makeIcon("↶");
export const Search = makeIcon("⌕");
export const Send = makeIcon("↗");
export const Settings = makeIcon("设");
export const Share2 = makeIcon("↗");
export const ShieldCheck = makeIcon("盾");
export const SlidersHorizontal = makeIcon("调");
export const Smartphone = makeIcon("机");
export const Smile = makeIcon("笑");
export const Sparkles = makeIcon("✦");
export const Star = makeIcon("☆");
export const Trash2 = makeIcon("删");
export const Type = makeIcon("T");
export const User = makeIcon("我");
export const UserPlus = makeIcon("+人");
export const UserRound = makeIcon("人");
export const UsersRound = makeIcon("群");
export const Utensils = makeIcon("食");
export const Video = makeIcon("视");
export const X = makeIcon("×");
