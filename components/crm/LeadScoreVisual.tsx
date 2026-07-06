"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
import { LeadScoreResult } from "../../lib/crm/scoring";

interface LeadScoreVisualProps {
  score: LeadScoreResult;
  className?: string;
}

const LeadScoreVisual = ({ score, className }: LeadScoreVisualProps) => {
  // Determine badge variant based on priority
  const getBadgeVariant = () => {
    switch (score.priority) {
      case "critical":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex justify-between items-center">
          Lead Score
          <Badge variant={getBadgeVariant()}>{score.priority}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Progress value={score.score} className="h-2" />
          <span className="text-sm font-medium">{score.score}/100</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="flex flex-col">
            <span className="text-gray-500">Engagement</span>
            <span className="font-medium">{score.factors.engagement}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">Firmographics</span>
            <span className="font-medium">{score.factors.firmographics}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">Intent</span>
            <span className="font-medium">{score.factors.intent}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeadScoreVisual;