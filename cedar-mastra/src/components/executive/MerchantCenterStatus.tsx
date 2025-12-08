import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export const MerchantCenterStatus = () => {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Platform Status
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div>
                        <div className="text-xl font-bold text-red-600">Suspended</div>
                        <div className="text-sm text-muted-foreground">Google Merchant Center</div>
                    </div>
                </div>
                <div className="mt-4 text-xs text-muted-foreground border-t pt-2">
                    Reason: Security Policy Violation (Customer Data Exposure)
                </div>
            </CardContent>
        </Card>
    );
};
