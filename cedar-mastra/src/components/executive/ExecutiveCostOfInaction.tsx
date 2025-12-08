import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShieldAlert, Users } from "lucide-react";

export const ExecutiveCostOfInaction = () => {
    return (
        <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground flex items-center justify-between">
                    <span>POTENTIAL COST OF INACTION</span>
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-bold">URGENT</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex flex-col space-y-1">
                        <span className="text-sm font-medium text-muted-foreground flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" /> Revenue at Risk
                        </span>
                        <span className="text-2xl font-bold">$8,000/mo</span>
                        <span className="text-xs text-muted-foreground">Google Shopping Suspended</span>
                    </div>

                    <div className="flex flex-col space-y-1">
                        <span className="text-sm font-medium text-muted-foreground flex items-center">
                            <ShieldAlert className="h-4 w-4 mr-1" /> Data Breach Risk
                        </span>
                        <span className="text-2xl font-bold">~$18,500</span>
                        <span className="text-xs text-muted-foreground">Estimated avg. cost</span>
                    </div>

                    <div className="flex flex-col space-y-1">
                        <span className="text-sm font-medium text-muted-foreground flex items-center">
                            <Users className="h-4 w-4 mr-1" /> Exposure
                        </span>
                        <span className="text-2xl font-bold">~450</span>
                        <span className="text-xs text-muted-foreground">Recent orders exposed</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
