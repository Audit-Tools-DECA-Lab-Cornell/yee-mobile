import type { ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

interface IconProps {
    readonly color?: string;
    readonly size?: number;
}

function makeIcon(name: FeatherIconName) {
    return function Icon({ color, size = 16 }: IconProps) {
        return <Feather name={name} size={size} color={color} />;
    };
}

export const ArrowLeft = makeIcon("arrow-left");
export const ArrowRight = makeIcon("arrow-right");
export const ArrowUpRight = makeIcon("arrow-up-right");
export const BarChart3 = makeIcon("bar-chart-2");
export const Bell = makeIcon("bell");
export const Check = makeIcon("check");
export const CheckCircle2 = makeIcon("check-circle");
export const ChevronLeft = makeIcon("chevron-left");
export const ChevronRight = makeIcon("chevron-right");
export const CircleCheckBig = makeIcon("check-circle");
export const ClipboardCheck = makeIcon("clipboard");
export const Clock3 = makeIcon("clock");
export const CloudOff = makeIcon("cloud-off");
export const Eye = makeIcon("eye");
export const EyeOff = makeIcon("eye-off");
export const FileBarChart = makeIcon("bar-chart-2");
export const FileText = makeIcon("file-text");
export const KeyRound = makeIcon("key");
export const LayoutDashboard = makeIcon("grid");
export const LayoutList = makeIcon("list");
export const LogOut = makeIcon("log-out");
export const MapPin = makeIcon("map-pin");
export const MapPinned = makeIcon("map-pin");
export const Monitor = makeIcon("monitor");
export const Moon = makeIcon("moon");
export const RefreshCcw = makeIcon("refresh-ccw");
export const Save = makeIcon("save");
export const Search = makeIcon("search");
export const Send = makeIcon("send");
export const Settings = makeIcon("settings");
export const ShieldAlert = makeIcon("shield");
export const ShieldCheck = makeIcon("shield");
export const Sun = makeIcon("sun");
export const TriangleAlert = makeIcon("alert-triangle");
export const Type = makeIcon("type");
export const UploadCloud = makeIcon("upload-cloud");
export const UserRound = makeIcon("user");
export const WifiOff = makeIcon("wifi-off");
export const X = makeIcon("x");
