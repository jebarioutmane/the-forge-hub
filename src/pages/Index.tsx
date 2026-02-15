import { Hammer } from "lucide-react";

const Index = () => {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-center space-y-4">
        <Hammer className="h-16 w-16 text-primary mx-auto" />
        <h1 className="text-5xl font-bold tracking-wider">
          Welcome to <span className="text-primary">THE FORGE HUB</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Your workspace is ready. Start building something extraordinary.
        </p>
      </div>
    </div>
  );
};

export default Index;
